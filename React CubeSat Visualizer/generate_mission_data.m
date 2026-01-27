function generate_mission_data()
    disp('------------------------------------------------');
    disp('   QUETZAL-1 MISSION SIMULATION (MATLAB BACKEND)');
    disp('------------------------------------------------');

    %% 1. SETUP SATELLITE (The "File Safe" Method)
    tle1 = "1 45598U 98067RW  20156.50406087  .00018898  00000-0  34651-3 0  9997";
    tle2 = "2 45598  51.6436 213.9137 0003063 103.7997 256.4003 15.49397960  6248";
    
    % Create a temporary TLE file so MATLAB doesn't get confused
    tleFile = "quetzal_temp.tle";
    fid = fopen(tleFile, 'w');
    fprintf(fid, '%s\n%s', tle1, tle2);
    fclose(fid);
    
    % Simulation Time: Run for 4 hours
    startTime = datetime(2020, 6, 4, 12, 0, 0, 'TimeZone', 'UTC');
    stopTime = startTime + hours(4);
    sampleTime = 60; % seconds
    
    sc = satelliteScenario(startTime, stopTime, sampleTime);
    
    % Load from the file
    sat = satellite(sc, tleFile, "Name", "Quetzal-1");
    
    % Clean up
    delete(tleFile);

    % Define Ground Station: Waterloo, Ontario
    waterloo = groundStation(sc, 43.4643, -80.5204, "Name", "Waterloo");
    
    %% 2. RUN PROPAGATION (LLA)
    disp('>> Propagating Orbit...');
    
    % 'states' returns a 3xN matrix where:
    % Row 1 = Latitude, Row 2 = Longitude, Row 3 = Altitude
    geoPos = states(sat, "CoordinateFrame", "geographic");
    
    % Manually split the rows
    lat = geoPos(1, :);
    lon = geoPos(2, :);
    alt = geoPos(3, :);
    
    % Transpose to columns (Nx1) for JSON format
    lat = lat';
    lon = lon';
    alt = alt';
    
    numSteps = length(lat);

    %% 3. CALCULATE ATTITUDE (Euler Angles for DeckGL)
    disp('>> Calculating Attitude (Euler Angles)...');
    
    [p, v] = states(sat, "CoordinateFrame", "inertial");
    
    % Initialize Nx3 array for [Pitch, Yaw, Roll]
    orientations = zeros(numSteps, 3); 

    for i = 1:numSteps
        % Nadir Pointing Logic
        z_vec = -p(:,i) / norm(p(:,i)); 
        y_vec = cross(z_vec, v(:,i)); y_vec = y_vec / norm(y_vec);
        x_vec = cross(y_vec, z_vec);
        R = [x_vec, y_vec, z_vec]; 
        
        % Convert to Euler Angles (Degrees)
        % MATLAB 'eul' is usually [Z, Y, X] (Yaw, Pitch, Roll) in Radians
        eulRad = rotm2eul(R'); 
        
        % Convert to Degrees and re-order for DeckGL [Pitch(X), Yaw(Z), Roll(Y)]
        % Note: You may need to swap these depending on your model's axis
        orientations(i,:) = rad2deg([eulRad(3), eulRad(1), eulRad(2)]);
    end

    %% 4. CALCULATE PASSES (Waterloo)
    disp('>> Calculating Access to Waterloo...');
    ac = access(sat, waterloo);
    intvls = accessIntervals(ac);
    
    passes = []; % Initialize empty array
    
    if height(intvls) > 0
        for i = 1:height(intvls)
            % Use 'currentPass' structure to avoid variable collisions
            currentPass.aos_time = datestr(intvls.StartTime(i), 'yyyy-mm-ddTHH:MM:SSZ');
            
            timeDiff = seconds(intvls.StartTime(i) - startTime);
            currentPass.aos_index = round(timeDiff / 60);
            
            currentPass.duration_mins = round(intvls.Duration(i) / 60);
            currentPass.max_el = 45; % Placeholder elevation
            
            % Add to list
            if i == 1
                passes = currentPass;
            else
                passes(i) = currentPass;
            end
        end
    end

    %% 5. SIMULATE TELEMETRY
    t_sim = linspace(0, 4*pi, numSteps)';
    voltage = 3.9 + 0.1 * sin(t_sim); 
    solar = max(0, 200 * sin(t_sim)); 

    % Detect Anomalies (Voltage < 3.85)
    anomalies = find(voltage < 3.85);
    
    %% 6. EXPORT TO JSON
    disp('>> Exporting to mission_data.json...');
    
    data.meta.name = "MATLAB High-Fidelity Sim";
    data.meta.start_time = datestr(startTime, 'yyyy-mm-ddTHH:MM:SSZ');
    
    % Path: [Lon, Lat, Alt] (Nx3 Matrix)
    data.telemetry.path = [lon, lat, alt]; 
    
    % data.telemetry.orientation = quats; <--- DELETE THIS
    data.telemetry.orientation = orientations; % <--- USE THIS
    data.telemetry.timestamps = 0:(numSteps-1);
    
    % Colors (Yellow if Sun, Blue if Eclipse)
    colors = zeros(numSteps, 3);
    for i = 1:numSteps
        if solar(i) > 0
            colors(i,:) = [255, 215, 0];
        else
            colors(i,:) = [0, 100, 255];
        end
    end
    data.telemetry.colors = colors;
    
    data.telemetry.anomalies = anomalies - 1; % 0-based index
    data.telemetry.faults = [];
    
    data.telemetry.metrics.voltage = voltage;
    data.telemetry.metrics.solar = solar;
    
    data.passes = passes;

    % Write File
    jsonStr = jsonencode(data);
    
    % Output file path (Change if your public folder is different)
    outputPath = 'quetzal-dashboard/public/mission_data.json'; 
    
    fid = fopen(outputPath, 'w');
    if fid == -1
        error('Could not open file. Check your folder path!');
    end
    fprintf(fid, '%s', jsonStr);
    fclose(fid);
    
    disp('SUCCESS: mission_data.json generated correctly.');
end