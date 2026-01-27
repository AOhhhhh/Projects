import csv
import os

# ==========================================
# CONFIGURATION
# ==========================================
CLEANUP_NOISE = True
MIN_CONTACT_AREA = 10.0 

project_dir = ExtAPI.DataModel.Project.ProjectDirectory
rule_csv_path = os.path.join(project_dir, "contact_rules.csv")

def step2_assign_lookup():
    print("\n--- STAGE 2: CONTACT ASSIGNMENT (LOOKUP METHOD) ---")
    
    # 1. LOAD RULES
    rule_map = {}
    if os.path.exists(rule_csv_path):
        with open(rule_csv_path, 'r') as f:
            reader = csv.reader(f)
            try: next(reader)
            except: reader.next()
            for row in reader:
                if len(row) >= 3:
                    mat1 = row[0].strip()
                    mat2 = row[1].strip()
                    key = tuple(sorted((mat1, mat2)))
                    rule_map[key] = (row[2].strip(), float(row[3]) if len(row)>3 and row[3] else 0.0)
        print("Loaded {} rules.".format(len(rule_map)))
    else:
        print("Error: Rules CSV not found.")
        return

    # 2. BUILD MATERIAL MAP (Tree Scan)
    # Mapping: GeoBody_ID (Int) -> Material_Name (String)
    print("Building Geometry Material Map...")
    geo_mat_map = {}
    
    def map_tree_bodies(node):
        for child in node.Children:
            map_tree_bodies(child)
        
        # If this node is a Body in the Tree
        if "Body" in node.DataModelObjectCategory.ToString():
            try:
                # 1. Get the Text Name (e.g., "Stainless Steel")
                mat_name = node.Material 
                
                # 2. Get the Topology ID (The link to GeoData)
                geo_body = node.GetGeoBody()
                if geo_body:
                    geo_mat_map[geo_body.Id] = mat_name
            except:
                pass

    # Start scan at Geometry Root
    root_geo = ExtAPI.DataModel.Project.Model.Geometry
    map_tree_bodies(root_geo)
    print("Mapped materials for {} bodies.".format(len(geo_mat_map)))

    # 3. PROCESS CONTACTS
    connections = ExtAPI.DataModel.Project.Model.Connections
    updated_count = 0
    
    for group in connections.Children:
        if "ConnectionGroup" not in group.DataModelObjectCategory.ToString():
            continue
            
        print("Processing Group: {}".format(group.Name))
        
        for contact in group.Children:
            if "ContactRegion" not in contact.DataModelObjectCategory.ToString():
                continue
            
            try:
                # Get Geometry Entities (Faces)
                src_ref = contact.SourceLocation.Ids[0]
                tgt_ref = contact.TargetLocation.Ids[0]
                
                # Convert Face -> Parent Body -> ID
                src_geo_body = ExtAPI.DataModel.GeoData.GeoEntityById(src_ref).Body
                tgt_geo_body = ExtAPI.DataModel.GeoData.GeoEntityById(tgt_ref).Body
                
                # LOOKUP NAME FROM OUR MAP
                m1 = geo_mat_map.get(src_geo_body.Id, "Unknown")
                m2 = geo_mat_map.get(tgt_geo_body.Id, "Unknown")
                
                # Check Match
                key = tuple(sorted((m1, m2)))
                
                if key in rule_map:
                    rule = rule_map[key]
                    new_type = rule[0]
                    new_fric = rule[1]
                    
                    # Update Properties
                    if hasattr(ContactType, new_type):
                        contact.ContactType = getattr(ContactType, new_type)
                        if new_type == "Frictional":
                            contact.FrictionCoefficient = new_fric
                        
                        contact.Name = "{} to {} ({})".format(m1, m2, new_type)
                        updated_count += 1
                
                # Cleanup Noise
                if CLEANUP_NOISE:
                    total_area = sum([face.Area for face in contact.TargetLocation.Entities])
                    if (total_area * 1e6) < MIN_CONTACT_AREA:
                        contact.Delete()

            except Exception as e:
                pass

    print("--- COMPLETE: Updated {} contacts ---".format(updated_count))

step2_assign_lookup()