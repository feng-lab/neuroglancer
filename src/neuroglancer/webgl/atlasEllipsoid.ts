import { RefCounted } from "neuroglancer/util/disposable";
import { GL } from "neuroglancer/webgl/context";
import { Buffer, getMemoizedBuffer } from "neuroglancer/webgl/buffer";
import { getSphereIndexArray, getSphereVertexArray } from "neuroglancer/webgl/atlasSpheres";
import { ShaderBuilder, ShaderProgram } from "neuroglancer/webgl/shader";

export class AtlasEllipsoidRenderHelper extends RefCounted {
  private vertexBuffer: Buffer;
  private indexBuffer: Buffer;
  private numIndices: number;

  constructor(gl: GL) {
    super();
    this.indexBuffer = this.registerDisposer(getMemoizedBuffer(
      gl,
      WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER,
      getSphereIndexArray
    )).value;
    this.numIndices = 6;
  }

  defineShader(builder: ShaderBuilder) {
    builder.addAttribute('highp float', 'aFlag');
    builder.addVarying('highp mat4', 'vMatrixInverse');
    builder.addVarying('highp vec3', 'vPoint');
    builder.addUniform('highp float', 'uOrtho');
    builder.addVertexCode(`
void emitAtlasEllipsoid(
  mat4 projectionViewMatrix, 
  mat4 projectionInverseMatrix, 
  mat4 viewMatrix,
  highp float centerPosition[3],
  highp float xArray[3],
  highp float yArray[3],
  highp float zArray[3]
) {
  vec4 D = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 xVector = vec4(xArray[0], xArray[1], xArray[2], 0.0);
  vec4 yVector = vec4(yArray[0], yArray[1], yArray[2], 0.0);
  vec4 zVector = vec4(zArray[0], zArray[1], zArray[2], 0.0);
  vec4 center = vec4(centerPosition[0], centerPosition[1], centerPosition[2], 1.0);

  //mat4 T = mat4(3.0 ,3.0 ,2.0 ,0.0 , 0.0 ,2.0 ,0.0 ,0.0 , 0.0 ,0.0 ,1.0 ,0.0 , 0.0 ,0.0 ,0.0 ,1.0 );
  mat4 T = mat4(xVector, yVector , zVector , center );

  // get corner pos
  vec2 flags = mod(floor(vec2(aFlag/16.0, aFlag)), 16.0);
  // either -1 or 1, -1 -> left, 1 -> right
  float rightFlag = flags.x - 1.;
  // either -1 or 1, -1 -> down, 1 -> up
  float upFlag = flags.y - 1.;

  // get border
  mat4 PMT_T = transpose(projectionViewMatrix * T);
  float a2 = dot(PMT_T[3] * D, PMT_T[3]) * 2.0;   // 2.0*a
  float mb = dot(PMT_T[0] * D, PMT_T[3]) * 2.0;   // -b
  float c = dot(PMT_T[0] * D, PMT_T[0]);
  float x = (mb + rightFlag * sqrt(mb*mb - 2.0 * a2 * c)) / a2;

  mb = dot(PMT_T[1] * D, PMT_T[3]) * 2.0;   // -b
  c = dot(PMT_T[1] * D, PMT_T[1]);
  float y = (mb + upFlag * sqrt(mb*mb - 2.0*a2*c)) / a2;

  // other
  vMatrixInverse = inverse(viewMatrix * T);

  //color = attr_color;

  vec4 vertex_clipspace = vec4(x, y, 0.0, 1.0);
    // Calculate vertex position in modelview space
  vec4 eyeSpacePos = projectionInverseMatrix * vertex_clipspace;
  vPoint = eyeSpacePos.xyz / eyeSpacePos.w;

  // Pass transformed vertex
  gl_Position = vertex_clipspace;
}
    `);
    builder.addFragmentCode(`
vec4 emitAtlasEllipsoidFragment(mat4 projectionMatrix) {
  //vec3 rayOrigin = vec3(0.0 ,0.0, 0.0);
  //vec3 rayDirection = normalize(vPoint);
  vec3 rayOrigin = mix(vec3(0.0 ,0.0, 0.0), vPoint, uOrtho);
  vec3 rayDirection = mix(normalize(vPoint), vec3(0.0, 0.0, -1.0), uOrtho);

  vec4 xfpp = vMatrixInverse * vec4(rayOrigin, 1.0);
  vec4 c3 = vMatrixInverse * vec4(rayDirection, 0.0);

  vec4 D = vec4(1.0, 1.0, 1.0, -1.0);
  float a = dot(c3 * D, c3);
  float b = 2.0 * dot(xfpp * D, c3);
  float c = dot(xfpp * D, xfpp);
  float dist = b*b - 4.0 * a * c;

  if (dist < 0.0)
    discard;

  dist = (-b - sqrt(dist)) / (2.0*a);

  // point of intersection on ellipsoid surface
  vec3 ipoint = dist * rayDirection + rayOrigin;

  // Calculate depth in clipping space
  vec2 clipZW = ipoint.z * projectionMatrix[2].zw + projectionMatrix[3].zw;

  float depth = 0.5 + 0.5 * clipZW.x / clipZW.y;

  if (depth <= 0.0)
    discard;

  if (depth >= 1.0)
    discard;

  //fragDepth = depth;

  vec4 normal4 = transpose(vMatrixInverse) * (xfpp + dist * c3);
  vec3 normalDirection = normalize(normal4.xyz);
  //return apply_lighting_and_fog(vec4(0.5, 0.5, 0.5, 0.5), 1.0, vec4(0.1, 0.1, 0.1, 1.0), vec4(1.0,1.0,1.0,1.0), normalDirection, ipoint, vColor, 1.0);
  //return apply_lighting_and_fog(vec4(0.2, 0.2, 0.2, 1.0), 100.0, vec4(0.1, 0.1, 0.1, 1.0), vec4(1.0,1.0,1.0,1.0), normalDirection, ipoint, vec4(1.0, 1.0, 0.0, 1.0), 1.0);
  return apply_lighting_and_fog(vec4(0.2, 0.2, 0.2, 1.0), 100.0, vec4(0.1, 0.1, 0.1, 1.0), vec4(1.0,1.0,1.0,1.0), normalDirection, ipoint, vColor, 1.0);
  //return vec4(1.0, 0.0, 0.0, 0.3);
}
    `)
  }

  draw(shader: ShaderProgram, numInstances: number) {
    this.vertexBuffer = this.registerDisposer(getMemoizedBuffer(
      shader.gl,
      WebGL2RenderingContext.ARRAY_BUFFER,
      getSphereVertexArray,
      numInstances
    )).value;
    const aFlag = shader.attribute('aFlag');
    this.vertexBuffer.bindToVertexAttrib(
      aFlag, 
      /*components=*/1, 
      /*attributeType=*/WebGL2RenderingContext.FLOAT,
      /*normalized=*/false, 
      /*stride=*/4
    );
    this.indexBuffer.bind();
    shader.gl.drawElementsInstanced(
      WebGL2RenderingContext.TRIANGLES,
      this.numIndices,
      WebGL2RenderingContext.UNSIGNED_BYTE,
      /*offset=*/0,
      numInstances
    );
    shader.gl.disableVertexAttribArray(aFlag);
  }

}