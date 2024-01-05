export const glsl_emitCone = `
  // void emitCone(float bradius, float tradius, vec4 attr_origin, vec4 attr_axis ) {
    // void emitCone(vec4 attr_origin, vec4 attr_axis) {
    void emitCone() {
    bradius = aCenterAndRadius0.w * uRadiusScale;
    tradius = aCenterAndRadius1.w * uRadiusScale;
    // bradius = 1.0 * uRadiusScale;
    // tradius = 2.0 * uRadiusScale;

    vec2 flags = mod(floor(vec2(aFlag/16.0, aFlag)), 16.0);
    float rightFlag = flags.x;
    float upFlag = flags.y;

    //vec3 scaledOrigin = attr_origin.xyz;
    //vec3 scaledTop = attr_origin.xyz + attr_axis.xyz;
    vec3 scaledOrigin = (uModelMatrix * vec4(aCenterAndRadius0.xyz, 1.0)).xyz;
    // vec3 scaledOrigin = aCenterAndRadius0.xyz;
    vec3 scaledTop = (uModelMatrix * vec4(aCenterAndRadius0.xyz + aCenterAndRadius1.xyz, 1.0)).xyz;
    // vec3 scaledTop = (uModelMatrix * vec4(aCenterAndRadius0.xyz + vec3(aCenterAndRadius0.w , aCenterAndRadius1.xy), 1.0)).xyz;
    // vec3 scaledTop = aCenterAndRadius0.xyz + aCenterAndRadius1.xyz;
    vec3 scaledAxis = scaledTop - scaledOrigin;
    height = length(scaledAxis);
    inv_sqr_height = height * height;
    inv_sqr_height = 1.0 / inv_sqr_height;

    // vCombo1 = vec4(bradius, tradius, vHeight, vInvSqrHeight);

    vec3 h = normalize(scaledAxis);
    vAxis = normalize(uNormalMatrix * h);

    vec3 u = cross(h, vec3(1.0, 0.0, 0.0));
    if (dot(u,u) < 0.001)
      {u = cross(h, vec3(0.0, 1.0, 0.0));}
    u = normalize(u);
    vec3 v = normalize(cross(u, h));

    vU = normalize(uNormalMatrix * u);
    vV = normalize(uNormalMatrix * v);

    vec4 p1 = vec4(scaledOrigin + bradius * (u+v), 1.0);
    vec4 p2 = vec4(scaledOrigin + bradius * (-u+v), 1.0);
    vec4 p3 = vec4(scaledOrigin + bradius * (-u-v), 1.0);
    vec4 p4 = vec4(scaledOrigin + bradius * (u-v), 1.0);
    // vec4 p5 = vec4(scaledOrigin + scaledAxis.xyz + tradius * (u+v), 1.0);
    // vec4 p6 = vec4(scaledOrigin + scaledAxis.xyz + tradius * (-u+v), 1.0);
    // vec4 p7 = vec4(scaledOrigin + scaledAxis.xyz + tradius * (-u-v), 1.0);
    // vec4 p8 = vec4(scaledOrigin + scaledAxis.xyz + tradius * (u-v), 1.0);
    vec4 p5 = vec4(scaledOrigin + scaledAxis + tradius * (u+v), 1.0);
    vec4 p6 = vec4(scaledOrigin + scaledAxis + tradius * (-u+v), 1.0);
    vec4 p7 = vec4(scaledOrigin + scaledAxis + tradius * (-u-v), 1.0);
    vec4 p8 = vec4(scaledOrigin + scaledAxis + tradius * (u-v), 1.0);
    

    // p1 = uProjectionViewMatrix * uModelMatrix * p1;
    // p2 = uProjectionViewMatrix * uModelMatrix * p2;
    // p3 = uProjectionViewMatrix * uModelMatrix * p3;
    // p4 = uProjectionViewMatrix * uModelMatrix * p4;
    // p5 = uProjectionViewMatrix * uModelMatrix * p5;
    // p6 = uProjectionViewMatrix * uModelMatrix * p6;
    // p7 = uProjectionViewMatrix * uModelMatrix * p7;
    // p8 = uProjectionViewMatrix * uModelMatrix * p8;

    p1 = uProjectionViewMatrix * p1;
    p2 = uProjectionViewMatrix * p2;
    p3 = uProjectionViewMatrix * p3;
    p4 = uProjectionViewMatrix * p4;
    p5 = uProjectionViewMatrix * p5;
    p6 = uProjectionViewMatrix * p6;
    p7 = uProjectionViewMatrix * p7;
    p8 = uProjectionViewMatrix * p8;

    p1.xyz = p1.xyz / p1.w;
    p2.xyz = p2.xyz / p2.w;
    p3.xyz = p3.xyz / p3.w;
    p4.xyz = p4.xyz / p4.w;
    p5.xyz = p5.xyz / p5.w;
    p6.xyz = p6.xyz / p6.w;
    p7.xyz = p7.xyz / p7.w;
    p8.xyz = p8.xyz / p8.w;

    vec4 pmin = p1;
    pmin = min(pmin, p2);
    pmin = min(pmin, p3);
    pmin = min(pmin, p4);
    pmin = min(pmin, p5);
    pmin = min(pmin, p6);
    pmin = min(pmin, p7);
    pmin = min(pmin, p8);

    vec4 pmax = p1;
    pmax = max(pmax, p2);
    pmax = max(pmax, p3);
    pmax = max(pmax, p4);
    pmax = max(pmax, p5);
    pmax = max(pmax, p6);
    pmax = max(pmax, p7);
    pmax = max(pmax, p8);

    float depth = pmin.z < -1.0 && pmax.z > -1.0 ? -0.999 : pmin.z;
    // if (pmin.x < -1.0 && pmax.x > 1.0 && pmin.y < -1.0 && pmax.y > 1.0) {
    //   depth = -2.0;
    // }
    // float depth = mix(pmin.z, pmax.z, 0.5);
    
    vec4 vertex = vec4(mix(pmin.x, pmax.x, rightFlag), mix(pmin.y, pmax.y, upFlag), depth, 1.0);
    vec4 base4 = uViewMatrix * vec4(scaledOrigin, 1.0);
    vBase = base4.xyz;

    vec4 top4 = uViewMatrix * vec4(scaledOrigin + scaledAxis, 1.0);
    vTop = top4.xyz;
    vec4 tvertex = uProjectionMatrixInverse * vertex;

    // vPoint = tvertex.xyz / tvertex.w;
    vPoint = tvertex.xyz;

    gl_Position = vertex;
  }
`

export const glsl_emitConeFrag = `
// vec4 coneFragmentFunc(float bradius, float tradius, float invSqrHeight, float height) {
  vec4 coneFragmentFunc() {
  vec3 rayOrigin = mix(vec3(0.0,0.0,0.0), vPoint, uOrtho);
  vec3 rayDirection = mix(normalize(vPoint), vec3(0.0, 0.0, -1.0), uOrtho);
  mat3 basis = mat3(vU, vV, vAxis);
  vec3 D = rayDirection * basis;
  float bradius2 = bradius*bradius;
  float tradius2 = tradius*tradius;
  vec3 coneTip = vBase - vAxis * bradius * height / (tradius - bradius);
  float a0, a1, a2;
  if (tradius - bradius < 0.001)  {   // cylinder
    vec3 diff = vPoint - vBase;
    vec3 P = diff * basis;
    a0 = P.x*P.x + P.y*P.y - bradius2;
    a1 = P.x*D.x + P.y*D.y;
    a2 = D.x*D.x + D.y*D.y;
  } else {  //cone
    vec3 diff = vPoint - coneTip;
    vec3 P = diff * basis;
    vec3 factor = vec3(1.0, 1.0, - (tradius-bradius) * (tradius-bradius) * inv_sqr_height);
    a0 = dot(P * P, factor);
    a1 = dot(P * D, factor);
    a2 = dot(D * D, factor);
  }

  float d = a1*a1 - a0*a2;
  if (d < 0.0)
    discard;
  float dist = (-a1 - sqrt(d))/a2;

  vec3 ipoint = vPoint + dist * rayDirection;
  
  vec3 tmpPoint = ipoint - vBase;
  vec3 planeNormalDirection = cross(vAxis, tmpPoint);
  vec3 centerToSurfaceDirection = normalize(cross(planeNormalDirection, vAxis));
  vec3 baseEdge = vBase + centerToSurfaceDirection * bradius;
  vec3 topEdge = vTop + centerToSurfaceDirection * tradius;
  vec3 normalDirection = normalize(cross(planeNormalDirection, topEdge - baseEdge));

  float ratio = dot(ipoint-vBase, vec3(vTop-vBase)) * inv_sqr_height;
  vec4 color = mix(vBaseColor, vTopColor, ratio);
  float capTest = dot((ipoint - vTop), vAxis);

  // FLAT_CAP
  if (capTest > 0.0 || dot(rayDirection, -vAxis) > dot(normalize(baseEdge-topEdge), -vAxis)) {
    ipoint = ipoint + rayDirection *
      length(vTop - ipoint) * dot(normalize(vTop - ipoint), -vAxis) / dot(rayDirection, -vAxis);
    if (dot(ipoint-vTop, ipoint-vTop) > tradius2)
      discard;

    color = vTopColor;
    normalDirection = vAxis;
  }

  capTest = dot((ipoint - vBase), vAxis);

  // FLAT_CAP
  if (capTest < 0.0) {
    ipoint = ipoint + rayDirection *
      length(vBase - ipoint) * dot(normalize(vBase - ipoint), -vAxis) / dot(rayDirection, -vAxis);
    if (dot(ipoint-vBase, ipoint-vBase) > bradius2)
      discard;

    color = vBaseColor;
    normalDirection = -vAxis;
  }

  vec2 clipZW = ipoint.z * uProjectionMatrix[2].zw + uProjectionMatrix[3].zw;
  float depth = 0.5 + 0.5 * clipZW.x / clipZW.y;
  if (depth <= 0.0)
   discard;
  
  if (depth >= 1.0)
   discard;
  
  //fragDepth = depth;
  fragColor = apply_lighting_and_fog(
    vec4(0.2, 0.2, 0.2, 1.0), 
    100.0, 
    vec4(0.1, 0.1, 0.1, 1.0), 
    vec4(1.0, 1.0, 1.0, 1.0), 
    normalDirection, 
    ipoint, 
    color, 
    uAlpha
  );
  // fragColor = vec4(1.0, 0.0,0.0,1.0);
  return fragColor;

}

`