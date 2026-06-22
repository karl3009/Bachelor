"use strict";
window.onload = function () { main(); }
async function main() {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice({
          requiredFeatures: ['primitive-index']
    });
    const canvas = document.getElementById('my-canvas');
    const context = canvas.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });

    const wgslfile = document.getElementById('wgsl').src;
    const wgslcode = await fetch(wgslfile, { cache: "reload" }).then(r => r.text());
    const wgsl = device.createShaderModule({
        code: wgslcode
    })

    var TransBool = false;
    var TransButton = document.getElementById("TransButton");
    TransButton.addEventListener("click", function () {
        TransBool = !TransBool;
    })

    var lockBool = false;
    var lockButton = document.getElementById("lockButton");
    lockButton.addEventListener("click", function () {
        lockBool = !lockBool;
    })

    var RotateVal = -45;
    var RotateButton = document.getElementById("RotateButton");
    RotateButton.addEventListener("click", function () {
        RotateVal -= 45
        if (RotateVal >= 360){
            RotateVal = 0;
        }
    })

    var NextFrameButton = document.getElementById("NextFrameButton");
    NextFrameButton.addEventListener("click", function () {
        requestAnimationFrame(animate);
    })

    var AnimateBool = sessionStorage.getItem("AnimateBool") == "true";
    var AnimateButton = document.getElementById("AnimateButton");
    AnimateButton.addEventListener("click", function () {
        let newState = !AnimateBool;
        sessionStorage.setItem("AnimateBool", newState);
        location.reload();
    })
    
    var cameraXscale = document.getElementById("xscale_range");
    var cameraXscaleVal = document.getElementById("xscale_range").value / 10;
    cameraXscale.addEventListener("input", function () {
        cameraXscaleVal = document.getElementById("xscale_range").value / 10;
    })

    var cameraYscale = document.getElementById("yscale_range");
    var cameraYscaleVal = document.getElementById("yscale_range").value / 10;
    cameraYscale.addEventListener("input", function () {
        cameraYscaleVal = document.getElementById("yscale_range").value / 10;
    })

    var cameraZscale = document.getElementById("zscale_range");
    var cameraZscaleVal = document.getElementById("zscale_range").value / 10;
    cameraZscale.addEventListener("input", function () {
        cameraZscaleVal = document.getElementById("zscale_range").value / 10;
    })

    var Blurscale = document.getElementById("blurscale_range");
    var BlurscaleVal = document.getElementById("blurscale_range").value / 10;
    Blurscale.addEventListener("input", function () {
        BlurscaleVal = document.getElementById("blurscale_range").value / 10;
    })


    // Camera and view settings
    // Standard view
    var cam_x_val = 0; //-6 for picture in report
    var cam_y_val = 3.5;
    var cam_z_val = 15;
    var look_x_val = 0.0;
    var look_y_val = 0;

    // Look directly at teapot with mirror behind
    // var cam_x_val = 4;
    // var cam_y_val = 1.5;
    // var cam_z_val = 0;
    // var look_x_val = -1.55;
    // var look_y_val = 0;


    var camView;
    var camEye;
    var camLookat;
    var M_obj;


    var mirrorView;
    var mirrorProjection;
    var mirrorMVP;

    const keysHeld = new Set();
    document.addEventListener("keydown", (e) => keysHeld.add(e.code));
    document.addEventListener("keyup", (e) => keysHeld.delete(e.code));

    function updateCam() {
        const up = vec3(0, 1, 0);

        const forward = vec3(
            Math.sin(look_x_val) * Math.cos(look_y_val), //horizontal
            Math.sin(look_y_val), //vertical
            -Math.cos(look_x_val) * Math.cos(look_y_val) //depth
        );
        const right = vec3(
            Math.cos(look_x_val),
            0,
            Math.sin(look_x_val)
        );

        if (keysHeld.has("KeyW")) { cam_x_val += forward[0] * 0.05; cam_y_val += forward[1] * 0.05; cam_z_val += forward[2] * 0.05; }
        if (keysHeld.has("KeyS")) { cam_x_val -= forward[0] * 0.05; cam_y_val -= forward[1] * 0.05; cam_z_val -= forward[2] * 0.05; }
        if (keysHeld.has("KeyA")) { cam_x_val -= right[0] * 0.05; cam_z_val -= right[2] * 0.05; }
        if (keysHeld.has("KeyD")) { cam_x_val += right[0] * 0.05; cam_z_val += right[2] * 0.05; }
        if (keysHeld.has("Space")) { cam_y_val += 0.05; }
        if (keysHeld.has("ShiftLeft")) { cam_y_val -= 0.05; }
        if (keysHeld.has("ArrowLeft")) { look_x_val -= 0.02; }
        if (keysHeld.has("ArrowRight")) { look_x_val += 0.02; }
        if (keysHeld.has("ArrowUp")) { look_y_val += 0.02; }
        if (keysHeld.has("ArrowDown")) { look_y_val -= 0.02; }
        var eye = vec3(cam_x_val, cam_y_val, cam_z_val);
        var lookat = vec3(cam_x_val + forward[0], cam_y_val + forward[1], cam_z_val + forward[2]);

        if (lockBool){
            lookat = vec3(0, 1.5, 0)
        }
        return [lookAt(eye, lookat, up), eye, lookat];
    }


    const box_w = 4.0;
    const box_h = 5.0;
    const box_b = 3.0;
    const box_d = 4.0;
    const vertices_plane = [
        // --- BACK ---
        vec3(-box_w, -box_b, -box_d, 1.0), // bottom left
        vec3(box_w, -box_b, -box_d, 1.0), // bottom right
        vec3(box_w, box_h, -box_d, 1.0), // top right
        vec3(-box_w, -box_b, -box_d, 1.0), // bottom left
        vec3(box_w, box_h, -box_d, 1.0), // top right
        vec3(-box_w, box_h, -box_d, 1.0), // top left
        
        
        // --- BOT ---
        vec3(-box_w, -box_b, -box_d, 1.0), // back left
        vec3(box_w, -box_b, -box_d, 1.0), // back right
        vec3(box_w, -box_b, box_d, 1.0), // front right
        vec3(-box_w, -box_b, -box_d, 1.0), // back left
        vec3(box_w, -box_b, box_d, 1.0), // front right
        vec3(-box_w, -box_b, box_d, 1.0), // front left

        // --- TOP ---
        vec3(-box_w, box_h, -box_d, 1.0), // back left
        vec3(-box_w, box_h, box_d, 1.0), // front left
        vec3(box_w, box_h, box_d, 1.0), // front right
        vec3(-box_w, box_h, -box_d, 1.0), // back left
        vec3(box_w, box_h, box_d, 1.0), // front right
        vec3(box_w, box_h, -box_d, 1.0), // back right

        // --- Left ---
        vec3(-box_w, -box_b, box_d, 1.0), // front bottom
        vec3(-box_w, -box_b, -box_d, 1.0), // back bottom
        vec3(-box_w, box_h, -box_d, 1.0), // back top
        vec3(-box_w, -box_b, box_d, 1.0), // front bottom
        vec3(-box_w, box_h, -box_d, 1.0), // back top
        vec3(-box_w, box_h, box_d, 1.0), // front top

    ]
    const vertices_mirror_plane = [
        // --- RIGHT --
        vec3(box_w, -box_b, -box_d, 1.0), // back bottom
        vec3(box_w, -box_b, box_d, 1.0), // front bottom
        vec3(box_w, box_h, box_d, 1.0), // front top
        vec3(box_w, -box_b, -box_d, 1.0), // back bottom
        vec3(box_w, box_h, box_d, 1.0), // front top
        vec3(box_w, box_h, -box_d, 1.0), // back top 
    ]

    const obj_filename = "../objs/teapot.obj";
    const obj = await readOBJFile(obj_filename, 1, true);

    // Calulate middle of obj
    let obj_max_pos = vec3();
    let obj_min_pos = vec3();

    for (let i = 0; i < obj.vertices.length; i += 3) {
        for (let axis = 0; axis < 3; axis++) {
            if (obj.vertices[i + axis] > obj_max_pos[axis]) {
                obj_max_pos[axis] = obj.vertices[i + axis];
            }
        }
        for (let axis = 0; axis < 3; axis++) {
            if (obj.vertices[i + axis] < obj_min_pos[axis]) {
                obj_min_pos[axis] = obj.vertices[i + axis];
            }
        }

    }
    const obj_center = vec3((obj_max_pos[0] + obj_min_pos[0]) / 2,
        (obj_max_pos[1] + obj_min_pos[1]) / 2,
        (obj_max_pos[2] + obj_min_pos[2]) / 2);

    //init
    var alpha_lp = Math.PI / 2;

    //translate y-value and direction 
    var ty = 0;
    var tybool = true;


    function updateUniforms(mvp_obj, mvp_plane, M_obj, eye, mirror_mvp) {
        let uniformData = new Float32Array(16 + 16 + 16 + 4);
        //WGSL: struct
        //struct Uniforms {
        //    mvp: array<mat4x4f, 1>,   // 16
        //    mvp2: mat4x4f,            // 16
        //    model: mat4x4f,           // 16
        //    eye: vec3f,               // 4
        // }

        // Teapot Object 
        uniformData = new Float32Array(16 + 16 + 16 + 4);
        uniformData.set(flatten(mvp_obj), 0);
        uniformData.set(flatten(M_obj), 32);
        uniformData.set([...eye], 48);
        uniformData.set([BlurscaleVal],51);
        device.queue.writeBuffer(uniformBuffer_obj, 0, uniformData);

        // Plane Object
        uniformData = new Float32Array(16 + 16 + 16 + 4);
        uniformData.set(flatten(mvp_plane), 0);
        uniformData.set(flatten(mirror_mvp), 16);
        device.queue.writeBuffer(uniformBuffer_plane, 0, uniformData);

        // BG        
        device.queue.writeBuffer(uniformBufferBG, 0, flatten(inverse(camView)));
        device.queue.writeBuffer(uniformBufferBG, 64, flatten(inverse(P)));      
    }

    const positionBufferLayoutObj = {
        arrayStride: sizeof['vec4'],
        attributes: [{
            format: 'float32x4',
            offset: 0,
            shaderLocation: 0,
        }],
    };

    const positionBufferLayoutPlane = {
        arrayStride: sizeof['vec3'],
        attributes: [{
            format: 'float32x3',
            offset: 0,
            shaderLocation: 0,
        }],
    };

    const normalsBufferLayoutObj = {
        arrayStride: sizeof['vec4'],
        attributes: [{
            format: 'float32x4',
            offset: 0,
            shaderLocation: 1,
        }],
    };

    const BGPositionBufferLayout = {
        arrayStride: sizeof['vec3'],
        attributes: [{
            format: 'float32x3',
            offset: 0,
            shaderLocation: 0,
        }],
    };

    
    const pipeline_bg = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: wgsl,
            entryPoint: 'main_vs_bg',
            buffers: [BGPositionBufferLayout] 
        },
        fragment: {
            module: wgsl,
            entryPoint: 'main_fs_bg',
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: "cw", // options { "ccw", "cw" }
            cullMode: "front", // options { "none", "front", "back" }
        },
        depthStencil: {
            depthWriteEnabled: false,
            depthCompare: 'less-equal',
            format: 'depth24plus'
        },
    });
    
    const pipeline_obj = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: wgsl,
            entryPoint: 'main_vs_obj',
            buffers: [positionBufferLayoutObj, normalsBufferLayoutObj]
        },
        fragment: {
            module: wgsl,
            entryPoint: 'main_fs_obj',
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: "cw", // options { "ccw", "cw" }
            cullMode: "front", // options { "none", "front", "back" }
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        },
    });
    const pipeline_obj_mirrored = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: wgsl,
            entryPoint: 'main_vs_obj',
            buffers: [positionBufferLayoutObj, normalsBufferLayoutObj]
        },
        fragment: {
            module: wgsl,
            entryPoint: 'main_fs_obj',
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: "cw", // Changed from "cw"
            cullMode: "front", 
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        },
    });



    const pipeline_plane = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: wgsl,
            entryPoint: 'main_vs_plane',
            buffers: [positionBufferLayoutPlane]
        },
        fragment: {
            module: wgsl,
            entryPoint: 'main_fs_plane',
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: "cw", // options { "ccw", "cw" }
            cullMode: "none", // options { "none", "front", "back" }
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        },
    })

    const pipeline_mirror_plane = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: wgsl,
            entryPoint: 'main_vs_mirror_plane',
            buffers: [positionBufferLayoutPlane]
        },
        fragment: {
            module: wgsl,
            entryPoint: 'main_fs_mirror_plane',
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: 'triangle-list',
            frontFace: "cw", // options { "ccw", "cw" }
            cullMode: "none", // options { "none", "front", "back" }
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus'
        },
    })


    let bytelength = 64 + 16 + 64 + 64 + 16 + 16; // Buffers are allocated in vec4 chunks
    let uniforms = new ArrayBuffer(bytelength);

    var uniformBuffer_obj = device.createBuffer({
        size: uniforms.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    var uniformBuffer_plane = device.createBuffer({
        size: uniforms.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    let positionBufferObj = device.createBuffer({
        size: obj.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(positionBufferObj, 0, obj.vertices);

    let indicesBufferObj = device.createBuffer({
        size: obj.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indicesBufferObj, 0, obj.indices);

    let normalsBufferObj = device.createBuffer({
        size: obj.normals.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(normalsBufferObj, 0, obj.normals);

    let positionBufferPlane = device.createBuffer({
        size: flatten(vertices_plane).byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(positionBufferPlane, 0, flatten(vertices_plane));

    let positionBufferMirrorPlane = device.createBuffer({
        size: flatten(vertices_mirror_plane).byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(positionBufferMirrorPlane, 0, flatten(vertices_mirror_plane));

    const BGIndices = new Uint32Array([0, 1, 2, 2, 1, 3]);
    const BGIndexBuffer = device.createBuffer({
        size: BGIndices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(BGIndexBuffer, 0, BGIndices);


    var NDC = [
        vec3(-1, -1, 1),
        vec3(1, -1, 1),
        vec3(-1, 1, 1),
        vec3(1, 1, 1)
    ]
    let BGPositionBuffer = device.createBuffer({
        size: flatten(NDC).byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(BGPositionBuffer, 0, flatten(NDC));


    //------cube map start------//
    var cubemap = ['../textures/cm_left.png',   // POSITIVE_X
        '../textures/cm_right.png',         // NEGATIVE_X
        '../textures/cm_top.png',           // POSITIVE_Y
        '../textures/cm_bottom.png',        // NEGATIVE_Y
        '../textures/cm_back.png',          // POSITIVE_Z
        '../textures/cm_front.png'];        // NEGATIVE_Z

    async function load_Cubemap_texture(cubemap) {
        let imgs = [];

        for (var i = 0; i < cubemap.length; i++) {
            const response = await fetch(cubemap[i]);
            const blob = await response.blob();
            const img = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
            imgs.push(img);
        }

        return imgs
    }
    let imgs = await load_Cubemap_texture(cubemap);

    var mipmapsEnabled = true;

    const cubeTexStatic = device.createTexture({
        dimension: '2d',
        size: [imgs[0].width, imgs[0].height, 6],
        format: canvasFormat,
        mipLevelCount: mipmapsEnabled ? numMipLevels(imgs[0].width, imgs[0].height) : 1,
        usage: GPUTextureUsage.COPY_DST
            | GPUTextureUsage.TEXTURE_BINDING
            | GPUTextureUsage.RENDER_ATTACHMENT
            | GPUTextureUsage.COPY_SRC
    });
    
    const cubeTexDynamic = device.createTexture({
        dimension: '2d',
        size: [imgs[0].width, imgs[0].height, 6],
        format: canvasFormat,
        mipLevelCount: mipmapsEnabled ? numMipLevels(imgs[0].width, imgs[0].height) : 1,
        usage: GPUTextureUsage.COPY_DST
            | GPUTextureUsage.TEXTURE_BINDING
            | GPUTextureUsage.RENDER_ATTACHMENT
    });
    

    for (var i = 0; i < cubemap.length; i++) {
        device.queue.copyExternalImageToTexture(
            { source: imgs[i], flipY: true },
            { texture: cubeTexStatic, origin: { x: 0, y: 0, z: i } },
            { width: imgs[i].width, height: imgs[i].height },
        )
    }

    cubeTexStatic.sampler = device.createSampler({
        addressModeU: "repeat",// clamp-to-edge or repeat,  
        addressModeV: "repeat",
        minFilter: "linear", //nearest or linear,
        magFilter: "linear",
        mipmapFilter: "linear" // nearest or linear
    });
    cubeTexDynamic.sampler = cubeTexStatic.sampler

    //------cube map end------//

    var mirror_plane_Texture_for_obj = device.createTexture({
        format: canvasFormat, size: [canvas.width, canvas.height, 1],
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });

    mirror_plane_Texture_for_obj.sampler = device.createSampler({
        addressModeU: "repeat",// clamp-to-edge or repeat,
        addressModeV: "repeat",
        minFilter: "linear", //nearest or linear,
        magFilter: "linear",
        mipmapFilter: "linear" // nearest or linear
    });

    var mirror_plane_Texture = device.createTexture({
        format: canvasFormat, size: [canvas.width, canvas.height, 1],
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
    });

    mirror_plane_Texture.sampler = device.createSampler({
        addressModeU: "repeat",// clamp-to-edge or repeat,
        addressModeV: "repeat",
        minFilter: "linear", //nearest or linear,
        magFilter: "linear",
        mipmapFilter: "linear" // nearest or linear
    });

    // depth texture for dynmaic cubemap
    const cubeDepthTexture = device.createTexture({
        size: [imgs[0].width, imgs[0].height, 1],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    //depth texture for mirror plane
    const mirrorPlaneDepthTexture = device.createTexture({
        size: [canvas.width, canvas.height, 1],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    //depth texture for obj view of mirror plane
    const mirrorPlaneForObjDepthTexture = device.createTexture({
        size: [canvas.width, canvas.height, 1],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    const dynamicMirrorForObjBuffer = device.createBuffer({
        size: 208, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const dynamicMirrorForObjBuffer_plane = device.createBuffer({
        size: 208, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const dynamicMirrorBuffer_obj = device.createBuffer({
        size: 208, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const dynamicMirrorBuffer_plane = device.createBuffer({
        size: 208, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformBufferBG = device.createBuffer({
        size: 192, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformBufferBG_mirror = device.createBuffer({
        size: 192, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
        const uniformBufferBG_obj_mirror = device.createBuffer({
        size: 192, 
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    

    const bindGroup_dynamic_mirror_plane = device.createBindGroup({
        layout: pipeline_plane.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: dynamicMirrorBuffer_plane } },
        ],
    });

    const bindGroup_dynamic_mirror_obj = device.createBindGroup({
        layout: pipeline_obj.getBindGroupLayout(0), 
        entries: [
            { binding: 0, resource: { buffer: dynamicMirrorBuffer_obj } },
            { binding: 1, resource: cubeTexDynamic.sampler },
            { binding: 4, resource: cubeTexDynamic.createView({ dimension: 'cube' }) }
        ],
    })

    const bindGroup_dynamic_mirror_for_obj = device.createBindGroup({
        layout: pipeline_obj_mirrored.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: dynamicMirrorForObjBuffer } },
            { binding: 1, resource: cubeTexDynamic.sampler },
            { binding: 4, resource: cubeTexDynamic.createView({ dimension: 'cube' }) }
        ]
    })
    const bindGroup_dynamic_mirror_plane_for_obj = device.createBindGroup({
        layout: pipeline_plane.getBindGroupLayout(0),
        entries: [
            {binding: 0, resource: {buffer: dynamicMirrorForObjBuffer_plane}}
        ]
    })

    const bindGroupBG = device.createBindGroup({
        layout: pipeline_bg.getBindGroupLayout(0),
        entries: [{
            binding: 5,
            resource: { buffer: uniformBufferBG }
        },
        { binding: 1, resource: cubeTexStatic.sampler },
        { binding: 4, resource: cubeTexStatic.createView({ dimension: 'cube' }) },
        ],
    });
    const bindGroupBG_mirror = device.createBindGroup({
        layout: pipeline_bg.getBindGroupLayout(0),
        entries: [{
            binding: 5,
            resource: { buffer: uniformBufferBG_mirror }
        },
        { binding: 1, resource: cubeTexStatic.sampler },
        { binding: 4, resource: cubeTexStatic.createView({ dimension: 'cube' }) },
        ],
    });
    const bindGroupBG_obj_mirror = device.createBindGroup({
        layout: pipeline_bg.getBindGroupLayout(0),
        entries: [{
            binding: 5,
            resource: { buffer: uniformBufferBG_obj_mirror }
        },
        { binding: 1, resource: cubeTexStatic.sampler },
        { binding: 4, resource: cubeTexStatic.createView({ dimension: 'cube' }) },
        ],
    });

    const dynamicCubemapBuffers = [];
    const dynamicCubemapBuffers_BG = [];
    const dynamicCubemapBindGroups_plane = [];
    const dynamicCubemapBindGroups_mirror_plane = [];
    const dynamicCubemapBindGroups_BG = [];

    for (let i = 0; i < 6; i++) {
        const buffer = device.createBuffer({
            size: 208,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        dynamicCubemapBuffers.push(buffer);

        const bindGroup_plane = device.createBindGroup({
            layout: pipeline_plane.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: buffer } },
            ],
        });
        dynamicCubemapBindGroups_plane.push(bindGroup_plane);

        const bindGroup_mirror_plane_cubemap = device.createBindGroup({
            layout: pipeline_mirror_plane.getBindGroupLayout(0), 
            entries: [
                { binding: 0, resource: { buffer: buffer } },
                { binding: 1, resource: mirror_plane_Texture_for_obj.sampler },
                { binding: 2, resource: mirror_plane_Texture_for_obj.createView() },
            ],
        });
        dynamicCubemapBindGroups_mirror_plane.push(bindGroup_mirror_plane_cubemap);

        const bufferBG = device.createBuffer({
            size: 192,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        dynamicCubemapBuffers_BG.push(bufferBG);

        const bindGroup_BG = device.createBindGroup({
            layout: pipeline_bg.getBindGroupLayout(0),
            entries: [
                { binding: 5, resource: { buffer: bufferBG } },
                { binding: 1, resource: cubeTexStatic.sampler },
                { binding: 4, resource: cubeTexStatic.createView({ dimension: 'cube' }) },
            ],
        })
        dynamicCubemapBindGroups_BG.push(bindGroup_BG)
    }

    //depth texture obj
    const depthTexture = device.createTexture({
        size: { width: canvas.width, height: canvas.height },
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    var bindGroup_obj = device.createBindGroup({
        layout: pipeline_obj.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer_obj } },
            { binding: 1, resource: cubeTexDynamic.sampler },
            { binding: 4, resource: cubeTexDynamic.createView({ dimension: 'cube' }) }
        ],
    });

    var bindGroup_plane = device.createBindGroup({
        layout: pipeline_plane.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer_plane } },
        ],
    });


    var bindGroup_mirror_plane = device.createBindGroup({
        layout: pipeline_mirror_plane.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer_plane } },
            { binding: 1, resource: mirror_plane_Texture.sampler },
            { binding: 2, resource: mirror_plane_Texture.createView() },

        ],
    });

    // const fovy = 90;
    let cam_const = 1;
    const fovy = 2 * Math.atan(0.5 / cam_const) * (180 / Math.PI); //for same view as ray tracing

    const aspect = canvas.width / canvas.height;
    const near = 0.005;
    const far = 1000;
    const P = perspective(fovy, aspect, near, far);
    const Mst = mat4(
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 0.5, 0.5,
        0, 0, 0, 1,
    );
    const projection = mult(Mst, P);

    function animate() {

        const S = scalem(cameraXscaleVal, cameraYscaleVal, cameraZscaleVal);
        if (TransBool) {
            if (tybool) {
                ty = ty + 0.05;
            } else {
                ty = ty - 0.05;
            }
            if (ty <= -3 || ty >= 3) {
                tybool = !tybool
            }
        };

        //view
        var updateCam_res = updateCam();
        camView = updateCam_res[0];
        camEye = updateCam_res[1];
        camLookat = updateCam_res[2];

        //obj
        const T = translate(0, ty, 0);
        const R = rotateY(RotateVal) 
        M_obj = mult(R,mult(T, S));
        const mvp_obj = mult(projection, mult(camView, M_obj));

        //plane
        const mvp_plane = mult(projection, camView);
        

        const renderPosMirror = vec3(-camEye[0] + box_w * 2, camEye[1], camEye[2]);
        const mirrorLookAt = vec3(-camLookat[0] + box_w * 2, camLookat[1], camLookat[2]);        
        mirrorProjection = projection
        mirrorView = lookAt(renderPosMirror, mirrorLookAt, vec3(0, 1, 0));
        mirrorMVP = mult(mirrorProjection, mirrorView);

        updateUniforms(mvp_obj, mvp_plane , M_obj, camEye, mirrorMVP);

        render();

        if(AnimateBool){
            requestAnimationFrame(animate);
        }
    }

    //constants for Dynamic EM renderpass
    const cubeProjectionBase = perspective(90, 1.0, 0.01, 1000.0);

    //flip x-values of projectionMatrix, reference: https://github.com/webgpu/webgpu-samples/issues/341 and https://www.w3.org/TR/webgpu/#texture-view-creation
    //The perspective fuction in MV.js uses right hand system while cube maps use left hand
    //so we translate by flipping the x-values 
    const cubeProjection = mult(cubeProjectionBase, scalem(-1, 1, 1));


    //i found https://github.com/mrdoob/three.js/blob/master/src/cameras/CubeCamera.js
    //and used line 115: "if ( coordinateSystem === WebGLCoordinateSystem ) {"
    //as example for directions and ups. 

    const faceDirections = [
        vec3(1, 0, 0), vec3(-1, 0, 0), //left/right
        vec3(0, 1, 0), vec3(0, -1, 0), //top/bot
        vec3(0, 0, 1), vec3(0, 0, -1)  //front/back
    ];
    const faceUps = [
        vec3(0, 1, 0), vec3(0, 1, 0),
        vec3(0, 0, -1), vec3(0, 0, 1),
        vec3(0, 1, 0), vec3(0, 1, 0)
    ];

    let mirrorForObjMVP;


    function render() {
        const encoder = device.createCommandEncoder();
            encoder.copyTextureToTexture(
            { texture: cubeTexStatic },
            { texture: cubeTexDynamic },
            [imgs[0].width, imgs[0].height, 6]
        );

        //update mirorr plane texture
        const renderPosMirror = vec3(-camEye[0]+box_w*2,camEye[1],camEye[2])
        const mirrorMVP = mult(mirrorProjection, mirrorView)
        device.queue.writeBuffer(dynamicMirrorBuffer_plane, 0, flatten(mirrorMVP));

        let mirrorMVP_obj = mult(mirrorProjection, mult(mirrorView,M_obj)) 
        let mirrorUniformData = new Float32Array(16 + 16 + 16 + 4);
        mirrorUniformData.set(flatten(mirrorMVP_obj), 0);
        mirrorUniformData.set(flatten(M_obj), 32); 
        mirrorUniformData.set([...renderPosMirror], 48);
        mirrorUniformData.set([BlurscaleVal],51)
        device.queue.writeBuffer(dynamicMirrorBuffer_obj, 0, mirrorUniformData);

        const mirrorPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: mirror_plane_Texture.createView({
                    baseMipLevel: 0,
                    mipLevelCount: 1,
                }),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
            }],
            depthStencilAttachment: {
                view: mirrorPlaneDepthTexture.createView(),
                depthLoadOp: 'clear',
                depthClearValue: 1.0,
                depthStoreOp: 'discard',
            }
        })

        //plane
        mirrorPass.setPipeline(pipeline_plane);
        mirrorPass.setVertexBuffer(0, positionBufferPlane);
        mirrorPass.setBindGroup(0, bindGroup_dynamic_mirror_plane);
        mirrorPass.draw(vertices_plane.length);

        //OBJ
        mirrorPass.setPipeline(pipeline_obj);
        mirrorPass.setVertexBuffer(0, positionBufferObj);
        mirrorPass.setVertexBuffer(1, normalsBufferObj);
        mirrorPass.setIndexBuffer(indicesBufferObj, "uint32");
        mirrorPass.setBindGroup(0, bindGroup_dynamic_mirror_obj);
        mirrorPass.drawIndexed(obj.indices.length, 1);

        //BG
        device.queue.writeBuffer(uniformBufferBG_mirror, 0, flatten(inverse(mirrorView)));
        device.queue.writeBuffer(uniformBufferBG_mirror, 64, flatten(inverse(mirrorProjection)));

        mirrorPass.setPipeline(pipeline_bg);
        mirrorPass.setVertexBuffer(0,BGPositionBuffer)
        mirrorPass.setIndexBuffer(BGIndexBuffer, "uint32");
        mirrorPass.setBindGroup(0, bindGroupBG_mirror)
        mirrorPass.drawIndexed(6,1);
        
        mirrorPass.end();

        //mirror texture for obj 
        const renderPosInvsTeapot = vec3(-(obj_center[0] + 0)+box_w*2, obj_center[1] + ty, obj_center[2]);
        const directionVector = vec3(
            renderPosInvsTeapot[0] + -1,
            renderPosInvsTeapot[1] + 0,
            renderPosInvsTeapot[2] + 0,
        );

        function reflect_frustum(verts, view) {   // function by Jeppe Frisvald
            let near_plane_verts = [];
            for(let i = 0; i < verts.length; i++) {
                const v = vec4(verts[i][0], verts[i][1], verts[i][2], 1.0);
                near_plane_verts.push(mult(view, v));
            }
            let n = 100, f = 100, l = 100, r = -100, b = 100, t = -100;
            n = f;
            for(let i = 0; i < near_plane_verts.length; i++)
                n = Math.min(n, -near_plane_verts[i][2]);
            for(let i = 0; i < near_plane_verts.length; i++) {
                l = Math.min(l, near_plane_verts[i][0]*n/-near_plane_verts[i][2]);
                r = Math.max(r, near_plane_verts[i][0]*n/-near_plane_verts[i][2]);
                b = Math.min(b, near_plane_verts[i][1]*n/-near_plane_verts[i][2]);
                t = Math.max(t, near_plane_verts[i][1]*n/-near_plane_verts[i][2]);
            }
            return [l, r, b, t, n, f];
        };

        let mirrorForObjView = lookAt(renderPosInvsTeapot, directionVector, vec3(0,1,0));

        let temp = reflect_frustum(vertices_plane, mirrorForObjView)
        const customP = frustum(temp[0],temp[1],temp[2],temp[3],temp[4],temp[5])
        const customP01 = mult(Mst,customP); //[-1,1] -> [0,1]
        // let customP01 = mult(Mst,projection) // not correct (kept to show error)

        mirrorForObjMVP = mult(customP01, mirrorForObjView);
        let mirrorForObjMVP_obj = mult(customP01, mult(mirrorForObjView, M_obj)) 
        device.queue.writeBuffer(uniformBufferBG_obj_mirror, 128, flatten(inverse(customP01)));
       
        let mirrorForObjUniformData = new Float32Array(16 + 16 + 16 + 4);
        mirrorForObjUniformData.set(flatten(mirrorForObjMVP_obj), 0);
        mirrorForObjUniformData.set(flatten(M_obj), 32); 
        mirrorForObjUniformData.set([...renderPosInvsTeapot], 48);
        mirrorForObjUniformData.set([BlurscaleVal],51);
        
        device.queue.writeBuffer(dynamicMirrorForObjBuffer, 0, mirrorForObjUniformData);
        device.queue.writeBuffer(dynamicMirrorForObjBuffer_plane, 0, flatten(mirrorForObjMVP));
        
        const objMirrorPass = encoder.beginRenderPass({
            colorAttachments:[{
                view: mirror_plane_Texture_for_obj.createView({
                    baseMipLevel: 0,
                    mipLevelCount: 1,
                }),
                loadOp: 'clear',
                storeOp: 'store',
                // clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
            }],
            depthStencilAttachment: {
                view: mirrorPlaneForObjDepthTexture.createView(),
                depthLoadOp: 'clear',
                depthClearValue: 1.0,
                depthStoreOp: 'discard',
            }
        })

        //teapot
        objMirrorPass.setPipeline(pipeline_obj_mirrored)
        objMirrorPass.setVertexBuffer(0, positionBufferObj);
        objMirrorPass.setVertexBuffer(1, normalsBufferObj);
        objMirrorPass.setIndexBuffer(indicesBufferObj, "uint32");
        objMirrorPass.setBindGroup(0, bindGroup_dynamic_mirror_for_obj);
        objMirrorPass.drawIndexed(obj.indices.length, 1);

        //normal plane
        objMirrorPass.setPipeline(pipeline_plane);
        objMirrorPass.setVertexBuffer(0, positionBufferPlane);
        objMirrorPass.setBindGroup(0, bindGroup_dynamic_mirror_plane_for_obj);
        objMirrorPass.draw(vertices_plane.length);

        // BG
        device.queue.writeBuffer(uniformBufferBG_obj_mirror, 0, flatten(inverse(mirrorForObjView)));
        device.queue.writeBuffer(uniformBufferBG_obj_mirror, 64, flatten(inverse(customP01)));

        objMirrorPass.setPipeline(pipeline_bg);
        objMirrorPass.setVertexBuffer(0,BGPositionBuffer);
        objMirrorPass.setIndexBuffer(BGIndexBuffer, "uint32");
        objMirrorPass.setBindGroup(0, bindGroupBG_obj_mirror);
        objMirrorPass.drawIndexed(6,1);

        objMirrorPass.end();

        //update teapot texture
        const renderPosTeapot = vec3(obj_center[0] + 0, obj_center[1] + ty, obj_center[2] ); //teapot pos + centerering 
        for (let face = 0; face < 6; face++) {
            const dx = faceDirections[face][0];
            const dy = faceDirections[face][1];
            const dz = faceDirections[face][2];

            //create unit vector from teapot position towards face 
            const directionVectorTeapot = vec3(
                renderPosTeapot[0] + dx,
                renderPosTeapot[1] + dy,
                renderPosTeapot[2] + dz,
            );
            const faceView = lookAt(renderPosTeapot, directionVectorTeapot, faceUps[face]);
            const faceMVP = mult(cubeProjection, faceView);

            let faceUniforms = new Float32Array(16 + 16 + 16 + 4);
            faceUniforms.set(flatten(faceMVP), 0);           
            faceUniforms.set(flatten(mirrorForObjMVP), 16);

            device.queue.writeBuffer(dynamicCubemapBuffers[face], 0, faceUniforms);


            const cubePass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: cubeTexDynamic.createView({
                        dimension: '2d',
                        baseArrayLayer: face,
                        arrayLayerCount: 1,
                        baseMipLevel: 0,
                        mipLevelCount: 1
                    }),
                    loadOp: 'load', //clear or load depending if you want the static EM drawn as "background"
                    storeOp: 'store',
                }],
                depthStencilAttachment: {
                    view: cubeDepthTexture.createView(),
                    depthLoadOp: 'clear',
                    depthClearValue: 1.0,
                    depthStoreOp: 'discard',
                }
            });

            // Draw the plane into the cubemap
            // normal plane
            cubePass.setPipeline(pipeline_plane);
            cubePass.setVertexBuffer(0, positionBufferPlane);
            cubePass.setBindGroup(0, dynamicCubemapBindGroups_plane[face]);
            cubePass.draw(vertices_plane.length);

            //mirror plane
            cubePass.setPipeline(pipeline_mirror_plane);
            cubePass.setVertexBuffer(0, positionBufferMirrorPlane);
            cubePass.setBindGroup(0, dynamicCubemapBindGroups_mirror_plane[face]);
            cubePass.draw(vertices_mirror_plane.length);

            //BG
            device.queue.writeBuffer(dynamicCubemapBuffers_BG[face], 0, flatten(inverse(faceView)));
            device.queue.writeBuffer(dynamicCubemapBuffers_BG[face], 64, flatten(inverse(cubeProjection)));

            cubePass.setPipeline(pipeline_bg);
            cubePass.setVertexBuffer(0,BGPositionBuffer)
            cubePass.setIndexBuffer(BGIndexBuffer, "uint32");
            cubePass.setBindGroup(0, dynamicCubemapBindGroups_BG[face])
            cubePass.drawIndexed(6,1);

            cubePass.end();

        }

        //generate mipmaps as we useed a set mip level in dynamic EM renderpass 
        if (mipmapsEnabled) {
            generateMipmap(device, cubeTexDynamic);
        }
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            }
        });
        
        //OBJ
        pass.setPipeline(pipeline_obj);
        pass.setVertexBuffer(0, positionBufferObj);
        pass.setVertexBuffer(1, normalsBufferObj);
        pass.setIndexBuffer(indicesBufferObj, "uint32");
        pass.setBindGroup(0, bindGroup_obj);
        pass.drawIndexed(obj.indices.length, 1);
    

        //Plane
        pass.setPipeline(pipeline_plane);
        pass.setVertexBuffer(0, positionBufferPlane);
        pass.setBindGroup(0, bindGroup_plane);
        pass.draw(vertices_plane.length);

        //Mirror Plane
        pass.setPipeline(pipeline_mirror_plane);
        pass.setVertexBuffer(0, positionBufferMirrorPlane);
        pass.setBindGroup(0, bindGroup_mirror_plane);
        pass.draw(vertices_mirror_plane.length);

        //BG
        pass.setPipeline(pipeline_bg);
        pass.setVertexBuffer(0,BGPositionBuffer)
        pass.setIndexBuffer(BGIndexBuffer, "uint32");
        pass.setBindGroup(0, bindGroupBG)
        pass.drawIndexed(6,1);

        pass.end();
        device.queue.submit([encoder.finish()]);
    }

    animate();

}