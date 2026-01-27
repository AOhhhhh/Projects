import math

def inspect_hole_sizes():
    print("\n--- HOLE INSPECTOR TOOL ---")
    geo = ExtAPI.DataModel.GeoData
    
    # Dictionary to store {Radius_in_mm: Count}
    found_sizes = {}
    
    print("Scanning all faces...")
    
    for assembly in geo.Assemblies:
        for part in assembly.Parts:
            for body in part.Bodies:
                for face in body.Faces:
                    # Check if it looks like a cylinder
                    if "Cylinder" in str(face.SurfaceType):
                        try:
                            if hasattr(face, "Radius"):
                                # Convert Meter -> MM for easier reading
                                r_m = face.Radius
                                r_mm = round(r_m * 1000.0, 2) # Round to 2 decimal places
                                
                                if r_mm in found_sizes:
                                    found_sizes[r_mm] += 1
                                else:
                                    found_sizes[r_mm] = 1
                        except:
                            pass
    
    print("\n--- RESULTS ---")
    if len(found_sizes) == 0:
        print("No cylindrical faces found in the entire model.")
    else:
        print("Found the following hole sizes:")
        # Sort by size
        for r_mm in sorted(found_sizes.keys()):
            count = found_sizes[r_mm]
            # Guess the bolt size based on radius
            dia = r_mm * 2
            note = ""
            if 2.9 < r_mm < 3.3: note = "(Likely M6)"
            elif 3.9 < r_mm < 4.3: note = "(Likely M8)"
            elif 4.9 < r_mm < 5.3: note = "(Likely M10)"
            elif 5.9 < r_mm < 6.3: note = "(Likely M12)"
            
            print("  Radius: {} mm  (Dia: {} mm) -> Found {} faces {}".format(r_mm, dia, count, note))

    print("---------------------------------")
    print("Update 'TARGET_RADIUS' in the Auto-Bolter script with the value above (divide by 1000 for meters).")

inspect_hole_sizes()