## Recursive Real-Time Reflections for Deformable Objects
### Bachelor Thesis (22-06-2026), by Karl Gustav Kofoed Petersen (s235481)

This repository contains the code for my bachelor thesis at Technical University of Denmark DTU.

#### Repository structure
- Real-time
    - Contains the real time implementation of the scene described in the thesis.
    - Controls: (WASD + L shirt + Space) for camera position, (Arrow keys) for look at direction
    - "Animate" button: If the teapot is currently black, or there is no response to keyboard inputs. Then press "Animate" to continually cycle though the render passes or press the "Next Frame" to run one cycle of the render passes
    - "Lock view" button: locks the look at position the same position as the pre-rendered version. 
- Pre-rendered
    -  Contains the code for a implementation of a pre-rendered scene. The scene is equivalent to the scene in the real-time implementation
    - The majority of the code in this folder is written during the DTU course "02562 Rendering - Introduction, Fall 2025”, with the exception of the glossy function, with the exception of implementation of the glossy shader, creation of the scene and the addition of having a environment map, as the skybox 
- Pre-rendered-Cornell
    - Contains the code for a implementation of a pre-rendered scene, containing a Cornell box with two spheres inside. One sphere is glossy, the other a perfect mirror
    - The majority of the code in this folder is written during the DTU course "02562 Rendering - Introduction, Fall 2025”, with the exception of the glossy function
- Thesis
    - This is the bachelor thesis i wrote based on this project. 

#### Running the project
> This project is **NOT** supported in the Firefox browser. Confirmed to work on the Chrome browser

This project can be run on several browers, which supports WebGPU, but has only been tested on Chrome. Most browers however refuse to run the project for security reasons, as such the project can be ran in on local server instead.

Guide from DTU courses "02562 Rendering - Introduction, Fall 2025” and "02561 Computer graphics, Fall 2025"
    
    ## Guide to open local server
    # Check your version
    python -V
    # Go to the folder with the repository folder
    cd ...
    # If Python version is 3.X
    python3 -m http.server
    # On windows try "python" instead of "python3"
    # If Python version is 2.X
    python -m SimpleHTTPServer

When the server is open your browser and go to:  http://localhost:8000/, then navigate to relevant folder and open the "html.html" file.

##### Notes

For syntax in wgsl code use "WGSL Language Support" by Noah Labrecque, it does not support the function "primitive_index" which is used in real-time implementation

