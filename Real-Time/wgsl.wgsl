enable primitive_index; //does not work in firefox

struct Uniforms {
    mvp: array<mat4x4f, 1>,
    mvp2: mat4x4f,
    model: mat4x4f,
    eye: vec3f,
    blur: f32,
}

;

struct UniformsBG {
    invView: mat4x4f,
    invProj: mat4x4f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
@group(0) @binding(5) 
var<uniform> uniformsBG: UniformsBG;
@group(0) @binding(1)
var mySampler: sampler;
@group(0) @binding(2)
var myTexture: texture_2d<f32>;
@group(0) @binding(4)
var cubeMap: texture_cube<f32>;

struct VSOut_obj {
    @builtin(position) position: vec4f,
    @location(0) inPos: vec3f,
    @location(1) normal: vec3f,

    @location(4) r_w: vec3f,
    @location(5) v: vec3f,
    @location(6) blur: f32,
}

;

struct VSOut_mirror_plane {
    @builtin(position) position: vec4f,
    @location(0) inPos: vec3f,
    @location(1) clipPos: vec4f,
}

;

struct VSOut_plane {
    @builtin(position) position: vec4f,
    @location(0) inPos: vec3f,
}

;

struct VSOut_bg {
    @builtin(position) position: vec4f,
    @location(4) i_w: vec3f,
}

;

@vertex
fn main_vs_obj(@location(0) inPos: vec4f, @builtin(instance_index) instance: u32, @location(1) inNorm: vec4f) -> VSOut_obj {
    var out: VSOut_obj;

    let worldPos = uniforms.model * inPos;
    out.position = uniforms.mvp[instance] * inPos;
    out.inPos = worldPos.xyz;


    //normal to world space normal form local
    let n_w: vec3f = normalize((uniforms.model * vec4f(inNorm.xyz, 0)).xyz);
    out.normal = n_w;

    //incident vector (to obj from camera)
    let i_w = normalize(worldPos.xyz - uniforms.eye);

    let r_w = reflect(i_w, n_w);
    out.r_w = r_w;

    //vector (to camera from obj)
    let v = normalize(uniforms.eye - worldPos.xyz);
    out.v = v;

    out.blur = uniforms.blur;

    return out;
}

@vertex
fn main_vs_plane(@location(0) inPos: vec3f) -> VSOut_plane {
    var out: VSOut_plane;
    out.position = uniforms.mvp[0] * vec4f(inPos, 1);
    out.inPos = inPos;

    return out;
}

@vertex
fn main_vs_mirror_plane(@location(0) inPos: vec3f) -> VSOut_mirror_plane {
    var out: VSOut_mirror_plane;
    out.position = uniforms.mvp[0] * vec4f(inPos, 1.0);
    out.clipPos =  uniforms.mvp2 * vec4f(inPos, 1.0);
    out.inPos = inPos;

    return out;
}

@vertex
fn main_vs_bg(@location(0) inPos: vec3f, @builtin(instance_index) instance: u32)->VSOut_bg{
    var out: VSOut_bg;
    
    out.position = vec4f(inPos,1);

    let v = uniformsBG.invView;
    
    let Mview: mat4x4<f32> = mat4x4<f32>(vec4f(v[0].xyz, 0), vec4f(v[1].xyz, 0), vec4f(v[2].xyz, 0), vec4f(0, 0, 0, 0));

    let P = uniformsBG.invProj;

    let i_w = Mview * P * vec4f(inPos,1); 

    out.i_w = i_w.xyz;
    
    return out;
};

@vertex
fn main_vs_depth(@location(0) inPos: vec4f) -> @builtin(position) vec4f {
    return uniforms.mvp2 * (uniforms.model * inPos);
}

@fragment
fn main_fs_depth(@builtin(position) fragcoord: vec4f) -> @location(0) vec4f {
    return vec4f(vec3(fragcoord.z), 1.0);
}

@fragment
fn main_fs_bg(@location(4) i_w: vec3f)-> @location(0) vec4f{
    var color = textureSample(cubeMap,mySampler,i_w);
    return vec4f(color.xyz,1);
};


@fragment
fn main_fs_obj(@location(0) inPos: vec3f, @location(1) normal: vec3f, @location(4) r_w: vec3f, @location(5) v:vec3f, @location(6) blur:f32) -> @location(0) vec4f {

    var n = normalize(normal);
    
    let blur_level = blur;
    let base_color = vec3f(0.81,0.44,0.17);
    // let base_color = vec3f(1);
    let reflect_color = textureSampleLevel(cubeMap, mySampler, r_w, blur_level);
    let f0 = base_color;

    let schlick = f0 + (1-f0)*(pow(1.0-(max(dot(n,v),0.0)),5));

    var final_color = reflect_color.xyz * schlick;
    return vec4(final_color,reflect_color[3]);
}

@fragment
fn main_fs_plane(@location(0) inPos: vec3f, @builtin(primitive_index) prim_idx: u32) -> @location(0) vec4f {
    let colorArr = array<vec3f,8>(
        vec3f(0,1,1),
        vec3f(1,1,0),
        vec3f(1,0,1),
        vec3f(1,0,0),
        vec3f(0,1,1),
        vec3f(0,1,0),
        vec3f(0,0,1),
        vec3f(0,0,1),
    );
    let i_tmep = prim_idx/2;


    let color = colorArr[i_tmep % 8u];
    return vec4f(color.rgb, 0);
}

@fragment
fn main_fs_mirror_plane(@builtin(position) fragcoords: vec4f, @location(0) inPos: vec3f, @location(1) clipPos: vec4f) -> @location(0) vec4f {
    
    let ndc = clipPos.xy / clipPos.w;
    let uv = vec2f(ndc.x * 0.5 + 0.5, ndc.y * -0.5 + 0.5);
    let color = textureSample(myTexture,mySampler,uv);
    return vec4f(color.rgb, 1.00);
}