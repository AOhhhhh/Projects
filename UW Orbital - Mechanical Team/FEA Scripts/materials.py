import csv
import os
import sys
import clr

# 1. SETUP .NET POP-UPS (So you know it started)
clr.AddReference("System.Windows.Forms")
from System.Windows.Forms import MessageBox

def step2_project_dir_debug():
    try:
        # GET PROJECT DIRECTORY
        # This is where Ansys looks for files (usually the 'user_files' folder)
        project_dir = ExtAPI.DataModel.Project.ProjectDirectory
        
        # DEFINE PATHS
        mat_csv_path = os.path.join(project_dir, "materials.csv")
        log_file_path = os.path.join(project_dir, "Ansys_Assignment_Log.txt")
        DEFAULT_MATERIAL = "Stainless Steel"

        # 2. START LOGGING
        with open(log_file_path, "w") as f:
            f.write("--- ANSYS ASSIGNMENT LOG ---\n")
            f.write("Log saved to: " + log_file_path + "\n")
            f.write("Looking for CSV at: " + mat_csv_path + "\n")

        # Helper function to append to log
        def log(msg):
            with open(log_file_path, "a") as f:
                f.write(msg + "\n")

        # POP-UP 1: NOTIFICATION
        # We show the path so you know exactly where to find it
        MessageBox.Show("Script Started.\nLog file will be saved to:\n" + log_file_path, "Debug")

        # 3. GET MATERIALS
        materials = ExtAPI.DataModel.Project.Model.Materials
        available_mats = [m.Name for m in materials.Children]
        log("Available Materials: " + str(available_mats))
        
        # 4. READ CSV
        code_map = {}
        if os.path.exists(mat_csv_path):
            log("CSV Found. Reading...")
            with open(mat_csv_path, 'r') as f:
                reader = csv.reader(f)
                try: next(reader) # Skip header
                except: pass
                
                for row in reader:
                    if len(row) >= 2:
                        code_map[row[0].strip()] = row[1].strip()
            log("Loaded {} rules.".format(len(code_map)))
        else:
            log("CRITICAL: CSV NOT FOUND at " + mat_csv_path)

        # 5. ASSIGNMENT LOOP
        geometry = ExtAPI.DataModel.Project.Model.Geometry
        
        def process_node(node):
            for child in node.Children:
                process_node(child)
            
            if "Body" in node.DataModelObjectCategory.ToString():
                assigned = False
                for code, target in code_map.items():
                    if code in node.Name:
                        if target in available_mats:
                            node.Material = target
                            log("[MATCH] " + node.Name + " -> " + target)
                        else:
                            node.Material = DEFAULT_MATERIAL
                            log("[MISSING] " + target + " not found. Used Default.")
                        assigned = True
                        break
                
                if not assigned:
                    if DEFAULT_MATERIAL in available_mats:
                        node.Material = DEFAULT_MATERIAL
                        log("[DEFAULT] " + node.Name + " -> " + DEFAULT_MATERIAL)
                    else:
                        log("[FAIL] Default material not found!")

        process_node(geometry)
        
        log("--- EXECUTION FINISHED ---")
        
        # POP-UP 2: COMPLETION
        MessageBox.Show("Script Complete!\nCheck 'Ansys_Assignment_Log.txt' in your project folder.", "Success")

    except Exception as e:
        # If the script crashes, try to log it, or show a pop-up
        try:
            with open(log_file_path, "a") as f:
                f.write("\nCRITICAL SCRIPT ERROR: " + str(e))
        except:
            pass # If we can't write to file, just show the box
            
        MessageBox.Show("Error: " + str(e), "Script Crashed")

# RUN IT
step2_project_dir_debug()