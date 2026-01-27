import math
import clr

# Explicitly import BeamBehavior
try:
    from Ansys.ACT.Automation.Mechanical import BeamBehavior
except:
    pass

# ==========================================
# CONFIGURATION (ENTER IN MILLIMETERS)
# ==========================================
TARGET_RADIUS_MM = 2.0 
RADIUS_TOL_MM = 0.1 
MAX_BOLT_LEN_MM = 50.0
BOLT_MATERIAL = "Stainless Steel"

# ==========================================
# HELPER: SELECTION WRAPPER
# ==========================================
def create_selection(geo_id):
    sel = ExtAPI.SelectionManager.CreateSelectionInfo(SelectionTypeEnum.GeometryEntities)
    sel.Ids = [geo_id]
    return sel

# ==========================================
# GEOMETRY SCANNERS
# ==========================================
def get_cylindrical_faces(geo):
    cylinders = []
    print("Scanning for holes with Radius ~{} mm...".format(TARGET_RADIUS_MM))
    
    for assembly in geo.Assemblies:
        for part in assembly.Parts:
            for body in part.Bodies:
                for face in body.Faces:
                    if "Cylinder" in str(face.SurfaceType):
                        try:
                            if hasattr(face, "Radius"):
                                r_val = face.Radius
                                if r_val < 0.1: r_val = r_val * 1000.0
                                
                                if abs(r_val - TARGET_RADIUS_MM) < RADIUS_TOL_MM:
                                    cylinders.append(face)
                        except:
                            pass
    return cylinders

# ==========================================
# MAIN EXECUTION
# ==========================================
def create_beam_bolts_final():
    geo = ExtAPI.DataModel.GeoData
    print("\n--- STARTING AUTO-BOLTER (V2025 FINAL) ---")

    valid_faces = get_cylindrical_faces(geo)
    print("Found {} candidate faces.".format(len(valid_faces)))

    if len(valid_faces) < 2:
        print("Not enough faces found.")
        return

    # Group faces
    pairs = []
    used_ids = set()

    for i in range(len(valid_faces)):
        f1 = valid_faces[i]
        if f1.Id in used_ids: continue
        
        best_mate = None
        min_dist = MAX_BOLT_LEN_MM
        
        for j in range(i+1, len(valid_faces)):
            f2 = valid_faces[j]
            if f2.Id in used_ids: continue
            
            c1 = f1.Centroid
            c2 = f2.Centroid
            dist = math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)
            
            dist_mm = dist
            if dist < 1.0 and MAX_BOLT_LEN_MM > 10.0:
                 dist_mm = dist * 1000.0
            
            if dist_mm < MAX_BOLT_LEN_MM and dist_mm > 1.0: 
                best_mate = f2
                min_dist = dist_mm
                
        if best_mate:
            pairs.append((f1, best_mate))
            used_ids.add(f1.Id)
            used_ids.add(best_mate.Id)

    print("Identified {} bolt pairs.".format(len(pairs)))

    # Create Beams
    model = ExtAPI.DataModel.Project.Model
    connections = model.Connections
    
    count = 0
    created = 0
    for src_face, tgt_face in pairs:
        try:
            # 1. Create Named Selections
            ns_src = model.AddNamedSelection()
            ns_src.Name = "Bolt_Head_{}".format(src_face.Id)
            ns_src.Location = create_selection(src_face.Id)
            
            ns_tgt = model.AddNamedSelection()
            ns_tgt.Name = "Bolt_Thread_{}".format(tgt_face.Id)
            ns_tgt.Location = create_selection(tgt_face.Id)
            
            # 2. Add Beam
            beam = connections.AddBeam()
            beam.Radius = Quantity("{} [mm]".format(TARGET_RADIUS_MM))
            
            # 3. SCOPING (THE FIX FOR 2025)
            # Try Reference/Mobile first, fall back to Source/Target
            try:
                beam.ReferenceLocation = ns_src
                beam.MobileLocation = ns_tgt
            except:
                beam.SourceLocation = ns_src
                beam.TargetLocation = ns_tgt
            
            try: beam.Behavior = BeamBehavior.Deformable 
            except: pass
            
            if BOLT_MATERIAL:
                try: beam.Material = BOLT_MATERIAL
                except: pass
            
            beam.Name = "AutoBolt_{}".format(count)
            count += 1
            created += 1
            
        except Exception as e:
            print("Failed to create beam {}: {}".format(count, str(e)))

    print("--- BOLTING COMPLETE: Created {} Beams ---".format(created))

create_beam_bolts_final()