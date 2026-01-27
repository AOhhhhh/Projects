\section*{Overview}
Welcome to my projects repository. This collection highlights my work at the intersection of \textbf{mechanical engineering}, \textbf{fluid dynamics}, and \textbf{aerospace software}, with a focus on simulation and high-stakes hardware design.

\section*{Featured Projects}

\subsection*{2D Baseball Pitch Fluid Dynamics Simulation}
An exploration into the aerodynamics of various baseball pitches. This project utilizes \textbf{Python-based CFD (Computational Fluid Dynamics)} to model how seam orientation and spin rate influence pressure differentials and trajectory.

\begin{itemize}[leftmargin=1.5em]
    \item \textbf{Mathematical Modeling:} Calculated the \textbf{Magnus Force} ($F_M$) acting on the ball using:
    \begin{equation*}
        F_M = \frac{1}{2} C_L \rho A v^2
    \end{equation*}
    where $C_L$ is the lift coefficient, $\rho$ is the air density, $A$ is the cross-sectional area, and $v$ is the velocity.
    \item \textbf{Key Features:} Automated mesh generation for spherical geometries ($Re \approx 10^5$) and visualization of wake turbulence.
    \item \textbf{Stack:} Python, Matplotlib, NumPy.
\end{itemize}

\subsection*{React CubeSat Visualizer}
A web-based dashboard designed to display \textbf{telemetry data} and orientation for a \textbf{3U CubeSat}. It provides \textbf{real-time 3D rendering} of the satellite's attitude using quaternion data.

\begin{itemize}[leftmargin=1.5em]
    \item \textbf{Attitude Representation:} Implemented orientation processing using \textbf{quaternions} ($q$) to avoid gimbal lock:
    \begin{equation*}
        q = \begin{bmatrix} w & x & y & z \end{bmatrix}^T = \begin{bmatrix} \cos(\frac{\theta}{2}) & \hat{u} \sin(\frac{\theta}{2}) \end{bmatrix}^T
    \end{equation*}
    \item \textbf{Key Features:} Interactive 3D model, real-time sensor data charting, and a mock-telemetry API.
    \item \textbf{Stack:} React, Three.js (react-three-fiber), Tailwind CSS.
\end{itemize}

\subsection*{UW Orbital -- Mechanical Team}
Documentation and design files from my time on the \textbf{University of Waterloo's} satellite design team. This folder includes \textbf{FEA (Finite Element Analysis)} reports and \textbf{CAD assemblies} for structural components.

\begin{itemize}[leftmargin=1.5em]
    \item \textbf{Thermal Management:} Designed thermal straps optimized using \textbf{Fourier’s Law of Heat Conduction}:
    \begin{equation*}
        \dot{Q} = -k A \frac{dT}{dx}
    \end{equation*}
    where $\dot{Q}$ is the heat transfer rate and $k$ is the material's thermal conductivity.
    \item \textbf{Key Features:} Vibration isolation mounts and thermal strap design calculations to survive launch environments.
    \item \textbf{Tools:} SolidWorks, Ansys, MATLAB.
\end{itemize}
