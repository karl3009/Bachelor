// Most of the code in this file is from 
// "02562 Rendering - Introduction, Fall 2025 "

"use strict";
window.onload = function () { main(); }
async function main() {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();

    const canTimestamp = adapter.features.has('timestamp-query');
    const device = await adapter.requestDevice({
        requiredFeatures: [
            ...(canTimestamp ? ['timestamp-query'] : []),
        ],
    });
    const timingHelper = new TimingHelper(device);
    let gpuTime = 0;
    
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
    });
    var reload = document.getElementById("reload");
    reload.addEventListener("click", function () {
        render();
    })

    var cameraXpos = document.getElementById("xpos_range");
    cameraXpos.addEventListener("input", function () {
        updateUniforms();
        render();
    })
    var cameraYpos = document.getElementById("ypos_range");
    cameraYpos.addEventListener("input", function () {
        updateUniforms();
        render();
    })
    var cameraZpos = document.getElementById("zpos_range");
    cameraZpos.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var cameraCamConst = document.getElementById("camConst_range");
    cameraCamConst.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var PlaneMenu = document.getElementById("PlaneMenu");
    PlaneMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var ObjMenu = document.getElementById("ObjMenu");
    ObjMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var MirrorMenu = document.getElementById("MirrorMenu");
    MirrorMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var gammaSlider = document.getElementById("gamma_range");
    gammaSlider.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var texScaleSlider = document.getElementById("texScale_range");
    texScaleSlider.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var frameNumber = 0;
    var progressiveUpdate = true;
    var progressiveUpdateButton = document.getElementById("progressiveUpdateButton");
    progressiveUpdateButton.addEventListener("click", function () {
        progressiveUpdate = !progressiveUpdate;
        progressive.value = progressiveUpdate;
        frameNumber = 0;
        animate();
    })


    const aspect = canvas.width / canvas.height;

    function updateUniforms() {

        var xpos = cameraXpos.value/10;
        var ypos = cameraYpos.value/10;
        var zpos = cameraZpos.value/10  ;
        var cam_const = cameraCamConst.value / 10;

        const eye = vec3(xpos, ypos, zpos);

        const lap = vec3(0, 1.5, 0.0);
        const up = vec3(0, 1, 0);

        var v = normalize(subtract(lap, eye));
        var b1 = normalize(cross(v, up));
        var b2 = cross(b1, v);

        frameNumber = 0;

        new Float32Array(uniforms, 0, 20).set([aspect, cam_const, gammaSlider.value / 10, texScaleSlider.value / 100, ...eye, 0.0, ...b1, 0.0, ...b2, 0.0, ...v, 0.0]);
        new Uint32Array(uniforms, 19 * 4, 9).set([PlaneMenu.value, ObjMenu.value, MirrorMenu.value, 1, 1, 1, canvas.width, canvas.height, frameNumber]); //19*4 since the last 0.0 is ignored from previous line
        
        device.queue.writeBuffer(uniformBuffer, 0, uniforms);
    }

    let textures = new Object();
    textures.width = canvas.width;
    textures.height = canvas.height;
    textures.renderSrc = device.createTexture({
        size: [canvas.width, canvas.height],
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        format: 'rgba32float',
    });
    textures.renderDst = device.createTexture({
        size: [canvas.width, canvas.height],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        format: 'rgba32float',
    });

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

    const cubeTex = device.createTexture({
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
            { source: imgs[i], flipY: true, flipX: true },
            { texture: cubeTex, origin: { x: 0, y: 0, z: i } },
            { width: imgs[i].width, height: imgs[i].height },
        )
    }

    cubeTex.sampler = device.createSampler({
        addressModeU: "repeat",// clamp-to-edge or repeat,
        addressModeV: "repeat",
        minFilter: "linear", //nearest or linear,
        magFilter: "linear",
        mipmapFilter: "linear" // nearest or linear
    });
    //------cube map end------//

    const obj_filename = '../objs/teapot.obj';
    const obj = await readOBJFile(obj_filename, 1, true);

    var buffers = build_bsp_tree(obj, device, {});

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: wgsl,
            entryPoint: 'main_vs',
            buffers: [],
        },
        fragment: {
            module: wgsl,
            entryPoint: 'main_fs',
            targets: [{ format: canvasFormat },
            { format: "rgba32float" }
            ],
        },
        primitive: { topology: 'triangle-strip', },
    });



    const indexBuffer = device.createBuffer({
        size: obj.indices.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    });
    device.queue.writeBuffer(indexBuffer, 0, obj.indices);

    let mat_bytelength = obj.materials.length * 2 * sizeof['vec4'];
    var materials = new ArrayBuffer(mat_bytelength);
    const materialBuffer = device.createBuffer({
        size: mat_bytelength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
    });
    for (var i = 0; i < obj.materials.length; ++i) {
        const mat = obj.materials[i];
        const emission = vec4(mat.emission.r, mat.emission.g, mat.emission.b, mat.emission.a);
        const color = vec4(mat.color.r, mat.color.g, mat.color.b, mat.color.a);
        new Float32Array(materials, i * 2 * sizeof['vec4'], 8).set([...emission, ...color]);
    }
    device.queue.writeBuffer(materialBuffer, 0, materials);



    let bytelength = 8 * sizeof['vec4']; // Buffers are allocated in vec4 chunks
    let uniforms = new ArrayBuffer(bytelength);
    const uniformBuffer = device.createBuffer({
        size: uniforms.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 4, resource: { buffer: indexBuffer } },
        { binding: 6, resource: { buffer: materialBuffer } },
        { binding: 10, resource: { buffer: buffers.treeIds } },
        { binding: 11, resource: { buffer: buffers.bspTree } },
        { binding: 12, resource: { buffer: buffers.bspPlanes } },
        { binding: 13, resource: { buffer: buffers.attribs } },
        { binding: 14, resource: textures.renderDst.createView() },
        { binding: 15, resource: cubeTex.sampler },
        { binding: 16, resource: cubeTex.createView({ dimension: 'cube' }) },
        ],

    });

    function animate() {
        render();
        requestAnimationFrame(animate);
    }

    function render() {
        // Create a render pass in a command buffer and submit it
        const encoder = device.createCommandEncoder();
        const pass = timingHelper.beginRenderPass(encoder, {
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                storeOp: "store",
            },
            {
                view: textures.renderSrc.createView(),
                loadOp: "load",
                storeOp: "store"
            }
            ]
        });
        // Insert render pass commands here
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(4);

        pass.end();
        encoder.copyTextureToTexture({ texture: textures.renderSrc }, { texture: textures.renderDst }, [textures.width, textures.height]);
            
        device.queue.submit([encoder.finish()])
        timingHelper.getResult().then(time => {
            gpuTime = time / 1000 / 1000;
            gpuTime = gpuTime.toFixed(2);
            gputime.value = parseFloat(gpuTime);
        });

        if (progressiveUpdate) {
            frameNumber++;
            new Uint32Array(uniforms, 19 * 4, 9).set([PlaneMenu.value, ObjMenu.value, MirrorMenu.value, 1, 1, 1, canvas.width, canvas.height, frameNumber]); //19*4 since the last 0.0 is ignored from previous line
            device.queue.writeBuffer(uniformBuffer, 0, uniforms);
        }
    }

    updateUniforms();
    // render();
    animate();

}