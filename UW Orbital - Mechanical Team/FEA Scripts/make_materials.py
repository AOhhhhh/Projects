# RUN THIS IN WORKBENCH ACT CONSOLE
import System.Collections.Generic

# ==========================================
# 1. AUTO-DETECT ENGINEERING DATA
# ==========================================
target_system = None
eng_data = None

print("--- SEARCHING FOR ENGINEERING DATA ---")
# Loop through all systems to find one with an Engineering Data container
for sys in GetAllSystems():
    try:
        container = sys.GetContainer(ComponentName="Engineering Data")
        if container:
            target_system = sys
            eng_data = container
            print("Target System Found: " + sys.Name)
            break
    except:
        pass

if eng_data is None:
    print("CRITICAL ERROR: No system with 'Engineering Data' found in the Schematic.")
else:
    # ==========================================
    # 2. DEFINE ALL MATERIALS
    # ==========================================
    # Format: "Name": [Density (kg/m^3), Youngs (Pa), Poisson, Yield (Pa)]
    new_mats = {
        "FR-4 (PCB)":        [1850.0, 24.0e9, 0.16, 300.0e6],  # Approx Yield
        "PLA (3D Printed)":  [1240.0, 3.5e9, 0.36, 40.0e6],    # 40 MPa
        "Stainless Steel":   [8000.0, 1.93e11, 0.29, 215.0e6], # 304 SS
        "Aluminum Alloy":    [2770.0, 7.1e10, 0.33, 280.0e6]   # 6061-T6
    }

    print("--- GENERATING MATERIALS ---")
    for name, props in new_mats.items():
        try:
            # 1. Create Material
            mat = eng_data.CreateMaterial(Name=name)
            
            # 2. Add Density
            rho = mat.CreateProperty(Name="Density")
            rho.SetData(Variables=["Density"], Values=[str(props[0])])
            
            # 3. Add Elasticity
            elas = mat.CreateProperty(Name="Isotropic Elasticity")
            elas.SetData(Variables=["Young's Modulus"], Values=[str(props[1])])
            elas.SetData(Variables=["Poisson's Ratio"], Values=[str(props[2])])
            
            # 4. Add Yield Strength (Optional but good for reporting)
            try:
                yld = mat.CreateProperty(Name="Tensile Yield Strength")
                yld.SetData(Variables=["Tensile Yield Strength"], Values=[str(props[3])])
            except:
                pass # Some material types might reject yield if not configured right
            
            print("Created: " + name)
        except Exception as e:
            # If it fails, it usually means the material already exists.
            # We print the name so you know it's there.
            print("Skipped (Exists): " + name)

    print("--- UPDATE COMPLETE ---")
    print("IMPORTANT: Right-click 'Model' in the Schematic and select 'Refresh'!")