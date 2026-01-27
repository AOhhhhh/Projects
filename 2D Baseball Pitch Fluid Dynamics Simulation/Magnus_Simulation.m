clear all; close all; clc;

m = 0.145;  
R = 0.0366;  
A = pi*R^2;    
rho = 1.29;      
g = 9.81;   
Cd = 0.3;      


data = readtable('curves_final.xlsx');
values = table2array(data);
deltas = zeros(size(data,1),6);

figure;
hold on;
xlabel('X (m)');
ylabel('Y (m)');
title('Theretical XY Trajectories with and Without Magnus Effect)');
grid on;

for i = 1:size(data,1)

    v0 = values(i,4) * 0.44704;         
    spin_rate = values(i,5) * (values(i,6) / 100);  
    spin_angle = values(i,9);
    travel_plate = (60 - values(i,1)) * 0.3048; 
    rise_release = values(i,2) * 0.3048;  
    rise_target = values(i,3) * 0.3048;     

    omega_rise = cosd(spin_angle) * spin_rate * (2*pi/60); 
    omega_break = sind(spin_angle) * spin_rate * (2*pi/60); 

    theta_range = linspace(-5, 25, 200);
    calcd_angle = 0;
    min_error = inf;
    calcd_px = [];
    calcd_py = [];
    calcd_pz = [];

    for theta_deg = theta_range
        theta_rad = deg2rad(theta_deg);
        mag_v_travel = v0*cos(theta_rad);
        mag_v_rise = v0*sin(theta_rad);
        mag_v_break = 0;
        mag_p_trav0 = 0;
        mag_p_rise0 = rise_release;
        mag_p_break0 = 0;
        
        mag_p_trav = [];
        mag_p_rise = [];
        mag_p_break = [];


        for t = 0:0.001:2
            v = sqrt(mag_v_travel^2 + mag_v_rise^2 + mag_v_break^2);
            
            % Drag force
            Fd_mag = 0.5*rho*Cd*A*v^2;
            Fd_mag_travel = -Fd_mag*mag_v_travel/v;
            Fd_mag_rise = -Fd_mag*mag_v_rise/v;
            Fd_mag_break = -Fd_mag*mag_v_break/v;
            
            % Magnus force
            s_rise = abs(R*omega_rise/v);     
            s_break = abs(R*omega_break/v);
            
            if s_rise < 0.1
                Cl_Rise = s_rise*1.5;
            else 
                Cl_Rise = (s_rise-0.1)*(2/3) + 0.15;
            end

            if s_break < 0.1
                Cl_break = s_break*1.5;
            else 
                Cl_break = (s_break-0.1)*(2/3) + 0.15;
            end
            
            Fm_Rise = 0.5*rho*Cl_Rise*A*v^2;
            Fm_Break = 0.5*rho*Cl_break*A*v^2 * sign(mag_v_travel);
            
            mag_v_travel = mag_v_travel + Fd_mag_travel/m*0.001;
            mag_v_rise = mag_v_rise + (Fd_mag_rise + Fm_Rise)/m*0.001 - g*0.001;
            mag_v_break = mag_v_break + (Fd_mag_break + Fm_Break)/m*0.001;
            
            mag_p_trav0 = mag_p_trav0 + mag_v_travel*0.001;
            mag_p_rise0 = mag_p_rise0 + mag_v_rise*0.001;
            mag_p_break0 = mag_p_break0 + mag_v_break*0.001;
            
            mag_p_trav(end+1) = mag_p_trav0;
            mag_p_rise(end+1) = mag_p_rise0;
            mag_p_break(end+1) = mag_p_break0;

            if mag_p_trav0 >= travel_plate
                error = abs(mag_p_rise0 - rise_target);
                if error < min_error
                    min_error = error;
                    calcd_angle = theta_deg;
                    calcd_px = mag_p_trav;
                    calcd_py = mag_p_rise;
                    calcd_pz = mag_p_break;
                end
                break;
            end
            
            if mag_p_rise0 < 0
                break;
            end
        end
    end

    plot(calcd_px, calcd_py, 'b-', 'DisplayName', 'With Spin');

        theta_rad = deg2rad(calcd_angle);
        grav_v_travel = v0*cos(theta_rad);
        grav_v_rise = v0*sin(theta_rad);
        grav_v_break = 0;
        grav_p_trav0 = 0;
        grav_p_rise0 = rise_release;
        grav_p_break0 = 0;
        
        grav_p_trav = [];
        grav_p_rise = [];
        grav_p_break = [];
        
        for t = 0:0.001:2
            v = sqrt(grav_v_travel^2 + grav_v_rise^2 + grav_v_break^2);
            
            Fd_grav = 0.5*rho*Cd*A*v^2;
            Fd_grav_travel = -Fd_grav*grav_v_travel/v;
            Fd_grav_rise = -Fd_grav*grav_v_rise/v;
            Fd_grav_break = -Fd_grav*grav_v_break/v;
                        
            grav_v_travel = grav_v_travel + Fd_grav_travel/m*0.001;
            grav_v_rise = grav_v_rise + (Fd_grav_rise)/m*0.001 - g*0.001;
            grav_v_break = grav_v_break + (Fd_grav_break)/m*0.001;
            
            grav_p_trav0 = grav_p_trav0 + grav_v_travel*0.001;
            grav_p_rise0 = grav_p_rise0 + grav_v_rise*0.001;
            grav_p_break0 = grav_p_break0 + grav_v_break*0.001;
            

            grav_p_trav(end+1) = grav_p_trav0;
            grav_p_rise(end+1) = grav_p_rise0;
            grav_p_break(end+1) = grav_p_break0;


            if grav_p_trav0 >= travel_plate
               break
            end

        end

    deltas(i,1) = values(i,10);
    deltas(i,2) = -values(i,11);
    deltas(i,3) = (calcd_py(1,size(calcd_py,2)) - grav_p_rise(1,size(grav_p_rise,2))) * 39.37;
    deltas(i,4) = (calcd_pz(1,size(calcd_pz,2)) - grav_p_break(1,size(grav_p_break,2))) * 39.37;
    deltas(i,5) = deltas(i,3) - deltas(i,2);
    deltas(i,6) = deltas(i,4) - deltas(i,1);
    deltas(i,7) = 100* (deltas(i,3) - deltas(i,2)) / deltas(i,3);
    deltas(i,8) = 100* (deltas(i,4) - deltas(i,1)) / deltas(i,4);

    fprintf('Pitch %d: Required launch angle = %.2f°\n', i, calcd_angle);

    plot(grav_p_trav, grav_p_rise, 'r--', 'DisplayName', 'Without Spin');

end

daspect([3 1 1]); 

% Define circle parameters
radius = 0.0366;       % Radius in meters
center = [0, 0];       % Center coordinates [x, y]
theta = linspace(0, 2*pi, 100);  % Angle values for smooth circle

% Generate circle coordinates
x = center(1) + radius * cos(theta);
y = center(2) + radius * sin(theta);
data_column7 = linspace(0, 100, 100)';
normalized_data = data_column7 / 100;
custom_colormap = [linspace(0,1,100)', linspace(1,0,100)', zeros(100,1)];

x = deltas(:, 5);
y = deltas(:, 6);
c = deltas(:, 7);  



x = deltas(:, 5);
y = deltas(:, 6);
c = deltas(:, 7);
c_norm = c / 100;
cmap = [linspace(0,1,100)', linspace(1,0,100)', zeros(100,1)]; % green to red

figure; hold on; axis equal;

for i = 1:length(x)
    color_idx = max(1, min(100, round(c_norm(i) * 99) + 1));
    fill_color = cmap(color_idx, :);
    theta = linspace(0, 2*pi, 50);
    cx = 39.37 * R * cos(theta) + x(i);
    cy = 39.37 * R * sin(theta) + y(i);
    fill(cx, cy, fill_color, 'EdgeColor', 'none', 'FaceAlpha', 0.4);
end

plot(0, 0, 'ko', 'MarkerSize', 12, 'MarkerFaceColor', 'k'); % black circle at origin
xlabel('ΔX (in)');
ylabel('ΔY (in)');
title('Emprical vs Theoretical Pitch Placements');
colormap(cmap);
cb = colorbar;
cb.Ticks = [0, 1];
cb.TickLabels = {'0% Error', '100% Error'};