// All code in this file is from 
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

    var SphereMenu = document.getElementById("SphereMenu");
    SphereMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var TriangleMenu = document.getElementById("TriangleMenu");
    TriangleMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var PlaneMenu = document.getElementById("PlaneMenu");
    PlaneMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var TexModeMenu = document.getElementById("TexModeMenu");
    TexModeMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })
    var TexFilterMenu = document.getElementById("TexFilterMenu");
    TexFilterMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var TextureMenu = document.getElementById("TextureMenu");
    TextureMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    var SkyMenu = document.getElementById("SkyMenu");
    SkyMenu.addEventListener("input", function () {
        updateUniforms();
        render();
    })

    let jitter = new Float32Array(200); // allowing subdivs from 1 to 10
    const jitterBuffer = device.createBuffer({
        size: jitter.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    });



    var JitterSlider = document.getElementById("jitter_range");
    JitterSlider.addEventListener("input", function () {
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


    function compute_jitters(jitter, pixelsize, subdivs) {
        const step = pixelsize / subdivs;
        if (subdivs < 2) {
            jitter[0] = 0.0;
            jitter[1] = 0.0;
        }
        else {
            for (var i = 0; i < subdivs; ++i)
                for (var j = 0; j < subdivs; ++j) {
                    const idx = (i * subdivs + j) * 2;
                    jitter[idx] = (Math.random() + j) * step - pixelsize * 0.5;
                    jitter[idx + 1] = (Math.random() + i) * step - pixelsize * 0.5;
                }
        }
    }


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

    const width = canvas.width;
    const height = canvas.height;

    function updateUniforms() {

        var xpos = cameraXpos.value / 1;
        var ypos = cameraYpos.value / 1;
        var zpos = cameraZpos.value / 1;
        var cam_const = cameraCamConst.value / 100;
        //var cam_const = 3.5;

        const eye = vec3(xpos, ypos, zpos);
        //const eye = vec3(277.0, 275.0, -570.0)
        //const eye = vec3(-0.02, 0.11, 0.6);

        const lap = vec3(277.0, 275.0, 0.0); //cornell
        //const lap = vec3(0.15, 1.5, 0.0); // teapot
        //const lap = vec3(-0.02,0.11,0.0);

        const up = vec3(0, 1, 0);

        var v = normalize(subtract(lap, eye));
        var b1 = normalize(cross(v, up));
        var b2 = cross(b1, v);

        frameNumber = 0;

        new Float32Array(uniforms, 0, 20).set([aspect, cam_const, gammaSlider.value / 10, texScaleSlider.value / 10, ...eye, 0.0, ...b1, 0.0, ...b2, 0.0, ...v, 0.0]);
        new Uint32Array(uniforms, 19 * 4, 12).set([SphereMenu.value, TriangleMenu.value, PlaneMenu.value, TexModeMenu.value, TexFilterMenu.value, TextureMenu.value, JitterSlider.value, width, height, frameNumber, obj.light_indices.length, SkyMenu.value]); //19*4 since the last 0.0 is ignored from previous line
        compute_jitters(jitter, 1 / canvas.height, JitterSlider.value)
        device.queue.writeBuffer(jitterBuffer, 0, jitter);


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

    const obj_filename = '../objs/CornellBox.obj';
    //const obj_filename = '../../../objs/bunny.obj';

    const obj = await readOBJFile(obj_filename, 1, true); // file name, scale, ccw vertice

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

    const light_indicesBuffer = device.createBuffer({
        size: obj.light_indices.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    });
    device.queue.writeBuffer(light_indicesBuffer, 0, obj.light_indices);


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
            //{ binding: 1, resource: temp_text.createView() },
            { binding: 2, resource: { buffer: jitterBuffer } },
            //{ binding: 3, resource: { buffer: positionBuffer } },
            { binding: 4, resource: { buffer: indexBuffer } },
            //{ binding: 5, resource: { buffer: vertexNormalBuffer } },
            { binding: 6, resource: { buffer: materialBuffer } },
            //{ binding: 7, resource: { buffer: matidxBuffer } },
            { binding: 8, resource: { buffer: light_indicesBuffer } },
            //{ binding: 9, resource: { buffer: buffers.aabb } },
            { binding: 10, resource: { buffer: buffers.treeIds } },
            { binding: 11, resource: { buffer: buffers.bspTree } },
            { binding: 12, resource: { buffer: buffers.bspPlanes } },
            { binding: 13, resource: { buffer: buffers.attribs } },
            { binding: 14, resource: textures.renderDst.createView() }
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

            new Uint32Array(uniforms, 19 * 4, 11).set([SphereMenu.value, TriangleMenu.value, PlaneMenu.value, TexModeMenu.value, TexFilterMenu.value, TextureMenu.value, JitterSlider.value, width, height, frameNumber, obj.light_indices.length]); //19*4 since the last 0.0 is ignored from previous line
            device.queue.writeBuffer(uniformBuffer, 0, uniforms);
        }



    }

    updateUniforms();
    //render();
    animate();


}