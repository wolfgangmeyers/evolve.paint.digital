export function vert(): string {
  return `
  
  // an attribute will receive data from a buffer
  attribute vec4 a_position;

  attribute vec2 a_texCoord;

  varying vec2 v_texCoord;
 
  // all shaders have a main function
  void main() {
 
    // gl_Position is a special variable a vertex shader
    // is responsible for setting
    gl_Position = a_position;
    // pass the texCoord to the fragment shader
    // The GPU will interpolate this value between points
    v_texCoord = a_texCoord;
  }
  `;
}

export function frag(): string {
  return `
  // fragment shaders don't have a default precision so we need
  // to pick one. mediump is a good default
  precision highp float;

  // textures to compare
  uniform sampler2D u_rendered;
  uniform sampler2D u_src;

  // rgb2lab adapted from https://github.com/d3/d3-color/blob/master/src/lab.js
  // Which references https://beta.observablehq.com/@mbostock/lab-and-rgb
  const float K = 18.;
  const float Xn = 0.96422;
  const float Yn = 1.;
  const float Zn = 0.82521;
  const float t0 = 4. / 29.;
  const float t1 = 6. / 29.;
  const float t2 = 3. * t1 * t1;
  const float t3 = t1 * t1 * t1;

  
  // the texCoords passed in from the vertex shader.
  varying vec2 v_texCoord;

  float xyz2lab(float t) {
    return t > t3 ? pow(t, 1. / 3.) : t / t2 + t0;
  }

  float rgb2lrgb(float x) {
    return x <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4);
  }

  vec4 rgb2lab(vec4 rgb) {
    float r = rgb2lrgb(rgb.r);
    float g = rgb2lrgb(rgb.g);
    float b = rgb2lrgb(rgb.b);
    float y = xyz2lab(
      (0.2225045 * r + 0.7168786 * g + 0.0606169 * b) / Yn
    );
    float x, z;
    if (r == g && g == b) {
      x = y;
      z = y;
    } else {
      x = xyz2lab((0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / Xn);
      z = xyz2lab((0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / Zn);
    }
    return vec4(116. * y - 16., 500. * (x - y), 200. * (y - z), 1.);
  }


 
  void main() {
    vec4 input1 = texture2D(u_src, v_texCoord);
    vec4 input2 = texture2D(u_rendered, v_texCoord);
    vec4 lab1 = rgb2lab(input1);
    vec4 lab2 = rgb2lab(input2);
    // Less than 100% opacity means the pixel is not covered by the
    // painting, and should be considered 100% different.
    //if (input2.a < 0.1) {
    //  gl_FragColor = vec4(1., 1., 1., 1.);
    //} else {
      vec4 diff = lab1 - lab2;
      vec4 diffSq = diff * diff;
      //vec4 diffSq = vec4(diff.r * diff.r, diff.g * diff.g, diff.b * diff.b, 0.);
      float result = sqrt(diffSq.r + diffSq.g + diffSq.b) / 100.;
      if (result > 1.) {
          result = 1.;
      }
      if (result < 0.) {
          result = 0.;
      }
      gl_FragColor = vec4(result, result, result, 1.);
    //}
  }`;
}
