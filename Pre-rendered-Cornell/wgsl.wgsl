// All code in this file is from 
// "02562 Rendering - Introduction, Fall 2025 "
// with the exception of the glossy function
//

struct Uniforms {
    aspect: f32,
    cam_const: f32,
    gamma: f32,
    texScale: f32,
    eye: vec3f,
    b1: vec3f,
    b2: vec3f,
    v: vec3f,
    SphereMenu: u32,
    TriangleMenu: u32,
    PlaneMenu: u32,
    TexModeMenu: u32,
    TexFilterMenu: u32,
    TextureMenu: u32,
    jitterAmount: u32,
    width: u32,
    height: u32,
    frame: u32,
    light_indices_arrayLength: u32,
    SkyMenu: u32,
}

;
struct Material {
    emission: vec3f,
    diffuse: vec3f,
}

;

struct vertexAttributes {
    positions: vec3f,
    normal: vec3f,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;
// @group(0) @binding(1)
// var my_texture: texture_2d<f32>;
@group(0) @binding(2)
var<storage> jitter: array<vec2f>;

// @group(0) @binding(3)
// var<storage> vPositions: array<vec3f>;
@group(0) @binding(4)
var<storage> meshFaces: array<vec4u>;
// @group(0) @binding(5)
// var<storage> vNormals: array<vec3f>;

@group(0) @binding(6)
var<storage> materials: array<Material>;
// @group(0) @binding(7) //
// var<storage> matIndices: array<u32>;
@group(0) @binding(8)
var<storage> light_indices: array<u32>;

@group(0) @binding(10)
var<storage> treeIds: array<u32>;
@group(0) @binding(11)
var<storage> bspTree: array<vec4u>;
@group(0) @binding(12)
var<storage> bspPlanes: array<f32>;

@group(0) @binding(13)
var<storage> vAttributes: array<vertexAttributes>;

@group(0) @binding(14)
var renderTexture: texture_2d<f32>;

// struct Aabb {
//     min: vec3f,
//     max: vec3f,
// }

// ;
// @group(0) @binding(9)
// var<uniform> aabb: Aabb;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) coords: vec2f,
}

;

struct FSOut {
    @location(0) frame: vec4f,
    @location(1) accum: vec4f,
}

;

const PI = 3.14;
const MAX_LEVEL = 20u;
const BSP_LEAF = 3u;
var<private> branch_node: array<vec2u, MAX_LEVEL>;
var<private> branch_ray: array<vec2f, MAX_LEVEL>;

@vertex
fn main_vs(@builtin(vertex_index) VertexIndex: u32) -> VSOut {
    const pos = array<vec2f, 4>(vec2f(- 1.0, 1.0), vec2f(- 1.0, - 1.0), vec2f(1.0, 1.0), vec2f(1.0, - 1.0));
    var vsOut: VSOut;
    vsOut.position = vec4f(pos[VertexIndex], 0.0, 1.0);
    vsOut.coords = pos[VertexIndex];
    return vsOut;
}

// Define Ray struct
struct Ray {
    origin: vec3f,
    direction: vec3f,
    tmin: f32,
    tmax: f32
}

struct HitInfo {
    has_hit: bool,
    dist: f32,
    position: vec3f,
    normal: vec3f,
    diffuse: vec3f,
    //pd
    emission: vec3f,
    specular: vec3f,
    //ps
    ior: f32,
    shader: u32,
    shininess: f32,
    uv: vec2f,
    // texcoords
    face_idx: u32,
    emit: bool,
    throughput: vec3f,
}

struct Light {
    L_i: vec3f,
    w_i: vec3f,
    dist: f32,
}

;

struct Onb {
    tangent: vec3f,
    // b1
    binormal: vec3f,
    // b2
    normal: vec3f,
    // n
}

;

fn fresnel_R(cos_i: f32, cos_t: f32, ior: f32) -> f32 {
    var r1 = (cos_i - ior * cos_t) / (cos_i + ior * cos_t);
    var r2 = (ior * cos_i - cos_t) / (ior * cos_i + cos_t);

    var R = 0.5 * (r1 * r1 + r2 * r2);

    return R;

}

fn sample_point_light(pos: vec3f, intensity: vec3f, hit: ptr<function, HitInfo>, r: Ray) -> Light {
    var light: Light;
    light.L_i = intensity / pow(length(pos - hit.position), 2);
    light.w_i = normalize(pos - hit.position);
    light.dist = length(pos - hit.position);
    return light;
}

fn sample_directional_light(pos: vec3f, intensity: vec3f, hit: ptr<function, HitInfo>, r: Ray) -> Light {
    var light: Light;

    var l_e = intensity;
    var w_e = normalize(vec3(- 1));
    var dist = 1.0e32;

    light.L_i = l_e;
    light.w_i = - w_e;
    light.dist = dist;

    return light;
}

fn sample_area_light(pos: vec3f, t: ptr<function, u32>) -> Light {
    var light: Light;

    var array_n = uniforms.light_indices_arrayLength;
    var xi: f32 = rnd(t);
    var xi2: f32 = rnd(t);
    var i_tri = u32(xi * f32(array_n));

    let v0 = vAttributes[meshFaces[light_indices[i_tri]][0]].positions;
    let v1 = vAttributes[meshFaces[light_indices[i_tri]][1]].positions;
    let v2 = vAttributes[meshFaces[light_indices[i_tri]][2]].positions;

    let alpha = 1 - sqrt(xi);
    let beta = (1 - xi2) * sqrt(xi);
    let gamma = xi2 * sqrt(xi);

    let xlj = alpha * v0 + beta * v1 + gamma * v2;

    let light_pos = xlj;

    let dist = length(light_pos - pos);
    let w_i = normalize(light_pos - pos);
    var dir = light_pos - pos;
    let rsqrt = dot(dir, dir);
    let r = sqrt(rsqrt);
    dir = dir / r;

    let n = normalize(cross((v1 - v0), (v2 - v0)));
    let A = 0.5 * length(cross((v1 - v0), (v2 - v0)));

    let radiance = materials[meshFaces[light_indices[i_tri]].w].emission;

    let intensity = (max(dot(- w_i, n), 0.0) * radiance * A) / (rsqrt);

    light.L_i = intensity;
    light.w_i = w_i;
    light.dist = dist;

    return light;
}

fn spherical_direction(sin_theta: f32, cos_theta: f32, phi: f32) -> vec3f {
    return vec3f(sin_theta * cos(phi), sin_theta * sin(phi), cos_theta);
}

fn rotate_to_normal(n: vec3f, v: vec3f) -> vec3f {
    let s = sign(n.z + 1.0e-16f);
    let a = - 1.0f / (1.0f + abs(n.z));
    let b = n.x * n.y * a;
    return vec3f(1.0f + n.x * n.x * a, b, - s * n.x) * v.x + vec3f(s * b, s * (1.0f + n.y * n.y * a), - n.y) * v.y + n * v.z;
}

fn lambertian(r: ptr<function, Ray>, hit: ptr<function, HitInfo>, t: ptr<function, u32>) -> vec3f {

    var rho_d = hit.diffuse;
    var pl_pos = vec3f(0, 1, 0);
    var intensity = vec3(PI, PI, PI);

    var light = sample_area_light(hit.position, t);

    var Lo = rho_d / PI * light.L_i * max(dot(hit.normal, light.w_i), 0.0);

    var shadow = Ray(hit.position, light.w_i, 0.01, light.dist - 0.01);
    var hit2: HitInfo;
    if intersect_scene(&shadow, & hit2) {
        Lo = vec3f(0);
    }

    if (hit.emit) {
        Lo += hit.emission;
    }

    var theta = acos(sqrt(1 - rnd(t)));
    var phi = 2 * PI * rnd(t);

    var sph_dir = spherical_direction(sin(theta), cos(theta), phi);

    hit.throughput *= rho_d;
    var Pd = (hit.throughput.x + hit.throughput.y + hit.throughput.z) / 3;
    if (rnd(t) < Pd) {
        hit.throughput /= Pd;
        r.direction = rotate_to_normal(hit.normal, sph_dir);
        r.origin = hit.position;
        hit.has_hit = false;
        r.tmax = 1e8;
        r.tmin = 1e-2;
        hit.emit = false;
    }

    return (Lo);
}

fn phong(r: ptr<function, Ray>, hit: ptr<function, HitInfo>) -> vec3f {
    var Pd = hit.diffuse;
    var Ps = vec3f(0.1, 0.1, 0.1);
    var s = hit.shininess;
    var omega_o = normalize(- r.direction);

    var pl_pos = vec3f(0, 1, 0);
    var intensity = vec3(PI, PI, PI);
    var light = sample_point_light(pl_pos, intensity, hit, * r);

    var omega_r = reflect(- light.w_i, hit.normal);

    var temp = max(dot(omega_o, omega_r), 0);
    var temp2 = max(dot(light.w_i, hit.normal), 0);

    var Lr = Pd / PI + Ps * ((s + 2) / (2 * PI)) * pow(temp, s) * light.L_i * (temp2);
    return Lr;

}

fn mirror(r: ptr<function, Ray>, hit: ptr<function, HitInfo>) -> vec3f {

    r.direction = reflect(r.direction, hit.normal);
    r.origin = hit.position;
    hit.has_hit = false;
    hit.emit = true;
    r.tmax = 1e8;
    r.tmin = 1e-4;

    return vec3f(0);
}

fn refrac(r: ptr<function, Ray>, hit: ptr<function, HitInfo>) -> vec3f {

    var n1 = 1.0;
    //n_i
    var n2 = 1.5;
    //n_t
    var N = normalize(hit.normal);
    var w_i = normalize(- r.direction);
    var cosi = dot(w_i, N);

    if (cosi < 0) {
        // if from inside
        hit.ior = n2 / n1;
        N = - N;
        cosi = - cosi;
    }
    else {
        hit.ior = n1 / n2;
    }

    var cos2t = 1 - hit.ior * hit.ior * (1 - cosi * cosi);

    if (cos2t < 0.0) {
        return mirror(r, hit);
    }

    r.direction = hit.ior * (cosi * N - w_i) - N * sqrt(cos2t);
    hit.has_hit = false;
    r.origin = hit.position;
    r.tmax = 1e8;
    r.tmin = 1e-4;

    return vec3f(0);
}

fn transparent(r: ptr<function, Ray>, hit: ptr<function, HitInfo>, t: ptr<function, u32>) -> vec3f {

    var n1 = 1.0;
    //n_i
    var n2 = 1.5;
    //n_t
    var N = normalize(hit.normal);
    var w_i = normalize(- r.direction);
    var cosi = dot(w_i, N);

    if (cosi < 0.0) {
        // if from inside
        hit.ior = n2 / n1;
        N = - N;
        cosi = - cosi;
    }
    else {
        hit.ior = n1 / n2;
    }

    var cos2t = 1.0 - hit.ior * hit.ior * (1 - cosi * cosi);

    if (cos2t < 0.0) {
        return mirror(r, hit);
    }

    var cost = sqrt(cos2t);

    var Pd = 1.0;
    if (cos2t > 0) {
        Pd = fresnel_R(cosi, cost, hit.ior);
    }

    if (rnd(t) < Pd) {
        return mirror(r, hit);
    }
    r.direction = hit.ior * (cosi * N - w_i) - N * sqrt(cos2t);

    hit.has_hit = false;
    hit.emit = true;
    r.origin = hit.position;
    r.tmax = 1e8;
    r.tmin = 1e-4;

    return vec3f(0.0);
}

fn glossy(r: ptr<function, Ray>, hit: ptr<function, HitInfo>, t: ptr<function,u32> ) -> vec3f {
    //GGX
    let alpha = 0.05; // blur

    let xi1: f32 = rnd(t); //random value in [0, 1)
    let xi2: f32 = rnd(t); //different random vlaue in [0, 1)

    //sampling:
    let phi_m = 2*PI*xi2;
    let theta_m = atan((alpha*sqrt(xi1))/(sqrt(1-xi2))); //angle between m and n
    
    var n = normalize(hit.normal);
    var up = vec3f(0,1,0);

    //transform to local Cartesian tangent space from spherical coordinates 
    let m_local = vec3f(sin(theta_m)*cos(phi_m),sin(theta_m)*sin(phi_m),cos(theta_m));

    // TBN matrix
    let tangent = normalize(cross(up,n)); 
    let bitangent = cross(n,tangent);
    var m = normalize(tangent * m_local.x + bitangent * m_local.y + n * m_local.z);

    let w_o = normalize(-r.direction);
    let w_i = reflect(-w_o, m);

    if(dot(w_i,n)< 0.0){
        hit.has_hit = true;
        return vec3f(0);
    }

    let w_o_dot_n = max(dot(w_o, n), 1e-5);
    let w_i_dot_n = max(dot(w_i, n), 1e-5);

    let tan2_theta_i = (1.0 - w_i_dot_n * w_i_dot_n) / (w_i_dot_n * w_i_dot_n);
    let tan2_theta_o = (1.0 - w_o_dot_n * w_o_dot_n) / (w_o_dot_n * w_o_dot_n);

    let G1_i = 2/(1 + sqrt(1+pow(alpha,2)*tan2_theta_i));
    let G1_o = 2/(1 + sqrt(1+pow(alpha,2)*tan2_theta_o));
    let G = G1_i*G1_o; 


    let base_color = vec3f(0.81,0.44,0.17);
    let f0 = base_color;
    let w_o_dot_m = max(dot(w_o,m),0); 
    let w_i_dot_m = max(dot(w_i,m),0); 
    let schlick = f0 + (1-f0)*(pow(1.0-w_o_dot_m,5));


    let F = schlick;

    let m_dot_n = max(dot(m,n),1e-5);
       
    let weight = F * (w_i_dot_m * G)/(w_i_dot_m*m_dot_n);
    hit.throughput *= weight;
    r.direction = w_i;
    hit.has_hit = false;
    r.origin = hit.position;
    r.tmin = 1e-4;
    r.tmax = 1e8;

    return vec3f(0,0,0);
    // return weight;

}

fn shade(r: ptr<function, Ray>, hit: ptr<function, HitInfo>, t: ptr<function, u32>) -> vec3f {
    switch hit.shader {
        case 0 {
            return hit.diffuse + hit.emission;
        }
        case 1 {
            return lambertian(r, hit, t);
        }
        case 2 {
            return phong(r, hit);
        }
        case 3 {
            return mirror(r, hit);
        }
        case 4 {
            return refrac(r, hit);
        }
        case 5 {
            return glossy(r, hit, t);
        }
        case 6 {
            return transparent(r, hit, t);
        }

        case default {
            return hit.diffuse + hit.emission;
        }
    }
}

fn intersect_plane(r: Ray, hit: ptr<function, HitInfo>, position: vec3f, onb: Onb) -> bool {

    var o = r.origin;
    var n = onb.normal;
    var p0 = position;
    var omega = r.direction;

    if (dot(omega, n) == 0) {
        return false;
    }

    var tprime = (dot((p0 - o), n)) / (dot(omega, n));

    if (tprime > 0) {
        if (tprime < r.tmax && tprime > r.tmin) {
            hit.has_hit = true;
            hit.dist = tprime;
            hit.normal = onb.normal;
            hit.position = r.origin + tprime * r.direction;

            var scale = uniforms.texScale;

            var u = dot((hit.position - p0), onb.tangent) * scale;
            var v = dot((hit.position - p0), onb.binormal) * scale;
            hit.uv = vec2f(u, v);

            return true;
        }
    }
    return false;
}

fn intersect_triangle(r: Ray, hit: ptr<function, HitInfo>, i_face: u32 /*v: array<vec3f, 3>*/) -> bool {

    var v: array<vec3f, 3>;
    v[0] = vAttributes[meshFaces[i_face][0]].positions;
    v[1] = vAttributes[meshFaces[i_face][1]].positions;
    v[2] = vAttributes[meshFaces[i_face][2]].positions;

    var o = r.origin;
    var e0 = v[1] - v[0];
    var e1 = v[2] - v[0];
    var n = cross(e0, e1);
    var omega = r.direction;
    if (dot(omega, n) == 0) {
        return false;
    }

    var tprime = dot((v[0] - o), n) / (dot(omega, n));
    var beta = dot(cross((v[0] - o), omega), e1) / (dot(omega, n));
    var gamma = - dot(cross((v[0] - o), omega), e0) / dot(omega, n);
    var alpha = 1.0 - beta - gamma;

    if (beta >= 0.0 && gamma >= 0 && beta + gamma <= 1) {
        if (tprime < r.tmax && tprime > r.tmin) {
            hit.has_hit = true;
            hit.dist = tprime;
            let n0 = vAttributes[meshFaces[i_face][0]].normal;
            let n1 = vAttributes[meshFaces[i_face][1]].normal;
            let n2 = vAttributes[meshFaces[i_face][2]].normal;
            hit.normal = normalize(alpha * n0 + beta * n1 + gamma * n2);
            hit.position = r.origin + tprime * r.direction;
            hit.face_idx = i_face;
            return true;
        }
    }
    return false;
}

fn intersect_trimesh(r: ptr<function, Ray>, hit: ptr<function, HitInfo>) -> bool {
    var branch_lvl = 0u;
    var near_node = 0u;
    var far_node = 0u;
    var t = 0.0f;
    var node = 0u;
    for (var i = 0u; i <= MAX_LEVEL; i++) {
        let tree_node = bspTree[node];
        let node_axis_leaf = tree_node.x & 3u;
        if (node_axis_leaf == BSP_LEAF) {
            let node_count = tree_node.x >> 2u;
            let node_id = tree_node.y;
            var found = false;
            for (var j = 0u; j < node_count; j++) {
                let obj_idx = treeIds[node_id + j];
                if (intersect_triangle(*r, hit, obj_idx)) {
                    r.tmax = hit.dist;
                    found = true;
                }
            }
            if (found) {
                return true;
            }
            else if (branch_lvl == 0u) {
                return false;
            }
            else {
                branch_lvl--;
                i = branch_node[branch_lvl].x;
                node = branch_node[branch_lvl].y;
                r.tmin = branch_ray[branch_lvl].x;
                r.tmax = branch_ray[branch_lvl].y;
                continue;
            }
        }
        let axis_direction = r.direction[node_axis_leaf];
        let axis_origin = r.origin[node_axis_leaf];
        if (axis_direction >= 0.0f) {
            near_node = tree_node.z;
            // left
            far_node = tree_node.w;
            // right
        }
        else {
            near_node = tree_node.w;
            // right
            far_node = tree_node.z;
            // left
        }
        let node_plane = bspPlanes[node];
        let denom = select(axis_direction, 1.0e-8f, abs(axis_direction) < 1.0e-8f);
        t = (node_plane - axis_origin) / denom;
        if (t > r.tmax) {
            node = near_node;
        }
        else if (t < r.tmin) {
            node = far_node;
        }
        else {
            branch_node[branch_lvl].x = i;
            branch_node[branch_lvl].y = far_node;
            branch_ray[branch_lvl].x = t;
            branch_ray[branch_lvl].y = r.tmax;
            branch_lvl++;
            r.tmax = t;
            node = near_node;
        }
    }
    return false;
}

fn intersect_sphere(r: Ray, hit: ptr<function, HitInfo>, center: vec3f, radius: f32) -> bool {
    var o = r.origin;
    var c_vec = center;
    var omega = r.direction;

    var b2: f32 = dot(o - c_vec, omega);
    var c: f32 = dot(o - c_vec, o - c_vec) - pow(radius, 2);

    if (b2 * b2 - c <= 0) {
        return false;
    }
    var t1 = - b2 - sqrt(pow(b2, 2) - c);
    var t2 = - b2 + sqrt(pow(b2, 2) - c);

    if (t1 < r.tmax && t1 > r.tmin) {
        hit.has_hit = true;
        hit.dist = t1;
        hit.position = r.origin + t1 * r.direction;
        hit.normal = normalize(hit.position - center);
        return true;
    }
    if (t2 < r.tmax && t2 > r.tmin) {
        hit.has_hit = true;
        hit.dist = t2;
        hit.position = r.origin + t2 * r.direction;
        hit.normal = normalize(hit.position - center);
        return true;
    }
    return false;
}

// fn intersect_min_max(r: ptr<function, Ray>) -> bool {
//     let p1 = (aabb.min - r.origin) / r.direction;
//     let p2 = (aabb.max - r.origin) / r.direction;
//     let pmin = min(p1, p2);
//     let pmax = max(p1, p2);
//     let box_tmin = max(pmin.x, max(pmin.y, pmin.z)) - 1.0e-3f;
//     let box_tmax = min(pmax.x, min(pmax.y, pmax.z)) + 1.0e-3f;
//     if (box_tmin > box_tmax || box_tmin > r.tmax || box_tmax < r.tmin) {
//         return false;
//     }
//     r.tmin = max(box_tmin, r.tmin);
//     r.tmax = min(box_tmax, r.tmax);
//     return true;
// }

fn get_camera_ray(ipcoords: vec2f, b1: vec3f, b2: vec3f, v: vec3f, cam_const: f32, eye: vec3f) -> Ray {
    var q = b1 * ipcoords[0] + b2 * ipcoords[1] + v * cam_const;

    var ray: Ray;
    ray.origin = eye;
    ray.direction = q / length(q);
    ray.tmin = 1e-4;
    ray.tmax = 1e8;

    return ray;
}

fn texture_nearest(texture: texture_2d<f32>, uv: vec2f /*texcoords*/, repeat: bool) -> vec3f {
    let WH = textureDimensions(texture);
    // res

    var st = clamp((uv), vec2f(0, 0), vec2f(1, 1));

    if (repeat) {
        st = (uv) - floor(uv);
    }

    let ab = st * vec2f(WH);
    let UV = vec2u((ab) + 0.5) % (WH);

    let texcolor = textureLoad(texture, UV, 0);
    return texcolor.rgb;
}

fn texture_linear(texture: texture_2d<f32>, uv: vec2f /*texcoords*/, repeat: bool) -> vec3f {
    let WH = textureDimensions(texture);
    // res

    var st = clamp((uv), vec2f(0, 0), vec2f(1, 1));
    if (repeat) {
        st = (uv) - floor(uv);
    }

    let ab = st * vec2f(WH);
    let UV = vec2u((ab));

    let texcolor = textureLoad(texture, UV, 0);
    return texcolor.rgb;
}

fn intersect_scene(r: ptr<function, Ray>, hit: ptr<function, HitInfo>) -> bool {

    r.tmin = 0.02;
    const sphere1_center: vec3f = vec3f(420.0, 90.0, 370.0);
    const sphere1_radius: f32 = 90;
    const sphere1_rgb: vec3f = vec3f(0, 0, 0);
    if (intersect_sphere(*r, hit, sphere1_center, sphere1_radius)) {
        r.tmax = hit.dist;
        hit.emission = 0.1 * sphere1_rgb;
        hit.diffuse = 0.9 * sphere1_rgb;
        hit.shader = uniforms.SphereMenu;
        hit.shininess = 42;
    }

    r.tmin = 0.02;
    const sphere2_center: vec3f = vec3f(130.0, 90.0, 250.0);
    const sphere2_radius: f32 = 90;
    const sphere2_rgb: vec3f = vec3f(0, 0, 0);
    if (intersect_sphere(*r, hit, sphere2_center, sphere2_radius)) {
        r.tmax = hit.dist;
        hit.emission = 0.1 * sphere2_rgb;
        hit.diffuse = 0.9 * sphere2_rgb;
        hit.shader = uniforms.PlaneMenu;
        hit.shininess = 42;
    }

    if (intersect_trimesh(r, hit)) {
        r.tmax = hit.dist;
        hit.emission = materials[meshFaces[hit.face_idx].w].emission;
        hit.diffuse = materials[meshFaces[hit.face_idx].w].diffuse;
        hit.shader = uniforms.TriangleMenu;
    }
    return hit.has_hit;
}

fn tea(val0: u32, val1: u32) -> u32 {
    const N = 16u;
    // User specified number of iterations
    var v0 = val0;
    var v1 = val1;
    var s0 = 0u;
    for (var n = 0u; n < N; n++) {
        s0 += 0x9e3779b9;
        v0 += ((v1 << 4) + 0xa341316c) ^ (v1 + s0) ^ ((v1 >> 5) + 0xc8013ea4);
        v1 += ((v0 << 4) + 0xad90777d) ^ (v0 + s0) ^ ((v0 >> 5) + 0x7e95761e);
    }
    return v0;
}

// Generate random unsigned int in [0, 2^31)
fn mcg31(prev: ptr<function, u32>) -> u32 {
    const LCG_A = 1977654935u;
    // Multiplier from Hui-Ching Tang [EJOR 2007]
    * prev = (LCG_A * (*prev)) & 0x7FFFFFFF;
    return * prev;
}

// Generate random float in [0, 1)
fn rnd(prev: ptr<function, u32>) -> f32 {
    return f32(mcg31(prev)) / f32(0x80000000);
}

@fragment
fn main_fs(@builtin(position) fragcoord: vec4f, @location(0) coords: vec2f) -> FSOut {

    let launch_idx = u32(fragcoord.y) * uniforms.width + u32(fragcoord.x);
    var t = tea(launch_idx, uniforms.frame);
    let prog_jitter = vec2f(rnd(&t), rnd(&t)) / (f32(uniforms.height) * sqrt(f32(uniforms.jitterAmount)));

    var loops: i32 = i32(uniforms.jitterAmount * uniforms.jitterAmount);

    var bgcolor = vec4f(0.1, 0.3, 0.6, 1.0);
    if (uniforms.SkyMenu == 1) {
        bgcolor = vec4f(0, 0, 0, 1.0);
    }

    const max_depth = 10;
    let uv = vec2f(coords.x * uniforms.aspect * 0.5f, coords.y * 0.5f);
    var r: Ray;
    var result = vec3f(0.0);
    var Ps = vec3f(0.1, 0.1, 0.1);
    var hit: HitInfo;

    for (var x = 0; x < i32(loops); x++) {
        r = get_camera_ray(uv + jitter[x] + prog_jitter, uniforms.b1, uniforms.b2, uniforms.v, uniforms.cam_const, uniforms.eye);
        var hit = HitInfo(false, 0.0, vec3f(0.0), vec3f(0.0), vec3f(0.0), vec3f(0.0), Ps, 0, 1u, 42, uv, 0, true, vec3f(1));
        for (var i = 0; i < max_depth; i++) {
            if (intersect_scene(&r, & hit)) {
                result += hit.throughput * shade(&r, & hit, & t);
            }
            else {
                result += bgcolor.rgb * hit.throughput;
                break;
            }
            if (hit.has_hit) {
                break;
            }
        }
    }
    result /= f32(uniforms.jitterAmount * uniforms.jitterAmount);

    // Progressive update of image
    let curr_sum = textureLoad(renderTexture, vec2u(fragcoord.xy), 0).rgb ;//* f32(uniforms.frame);
    let accum_color = curr_sum + (result - curr_sum) / f32(uniforms.frame + 1u);
    //(result + curr_sum) / f32(uniforms.frame + 1u);
    var fsOut: FSOut;
    fsOut.frame = vec4f(pow(accum_color, vec3f(1.0 / uniforms.gamma)), bgcolor.a);
    fsOut.accum = vec4f(accum_color, 1.0);
    return fsOut;

}