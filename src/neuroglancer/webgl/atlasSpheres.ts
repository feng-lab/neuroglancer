import {RefCounted} from 'neuroglancer/util/disposable';
import {Buffer, getMemoizedBuffer } from 'neuroglancer/webgl/buffer';
import {GL} from 'neuroglancer/webgl/context';
import {ShaderBuilder, ShaderProgram} from 'neuroglancer/webgl/shader';

export function getSphereVertexArray(count: number) {
  const totalNum = count * 4;
  const result = new Float32Array(totalNum);
  for (let i = 0; i <= count; i++) {
    result[i*4] = 0;
    result[i*4+1] = 32;
    result[i*4+2] = 2;
    result[i*4+3] = 34;
  }
  return result;
}

export function getSphereIndexArray() {
  return new Uint8Array([
    0, 1, 2,
    2, 1, 3
  ]);
}

export class AtlasSphereRenderHelper extends RefCounted {
  private vertexBuffer: Buffer;
  private indexBuffer: Buffer;
  private numIndices: number;

  constructor(gl: GL) {
    super();
    
    this.indexBuffer =
        this.registerDisposer(getMemoizedBuffer(
                                  gl, WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER,
                                  getSphereIndexArray))
            .value;
    this.numIndices = 6;
  }

  defineShader(builder: ShaderBuilder) {
    builder.addAttribute('highp float', 'aFlag');
    builder.addVarying('highp vec3', 'vSphereCenter');
    builder.addVarying('highp vec3', 'vPoint');
    builder.addVarying('highp float', 'vRadius2');
    builder.addVarying('highp float', 'vMaterialShiniess');
    builder.addVarying('highp vec4', 'vMaterialSpecular');
    builder.addUniform('highp float', 'uBoxCorrection');
    builder.addUniform('highp float', 'uOrtho');


    // projectionMatrix = cameraMatrix * modelViewMat
    // normalTransformMatrix = (modelViewMat^{-1})^T

    // eff modelViewMat = modelViewMat * scalMat(radii)
    // normalTransformMatrix =  (modelViewMat * scalMat)^{-1}^T
    // =   (scalMat^{-1} * modelViewMat^{-1})^T
    // =   modelViewMat^{-1}^T * (scalMat^{-1})^T
    builder.addVertexCode(`
void emitSphere(mat4 projectionMatrix, mat4 viewMatrix, mat4 model, float radius, float modelPosition[3], float boxCorrection) {
  vRadius2 = radius * radius;
  highp vec2 flags = mod(floor(vec2(aFlag/16.0, aFlag)), 16.0);
  highp vec4 attr_specular_shininess = vec4(1.0, 1.0, 1.0, 1.0);

  highp float rightFlag = flags.x - 1.0;
  highp float upFlag = flags.y - 1.0;

  vMaterialSpecular = vec4(attr_specular_shininess.xyz, 1.);
	vMaterialShiniess = attr_specular_shininess.w;

  highp vec3 rightVector = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  highp vec3 upVector = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  highp vec3 cornerDirection = (boxCorrection*upFlag) * upVector + (boxCorrection*rightFlag) * rightVector;
  highp vec4 centerVertex = model * vec4(aVertexPosition0.xyz, 1.0);
  //vec4 centerVertex = vec4(projectModelVectorToSubspace(modelPosition), 1.0);
  //vec4 centerVertex = uModelViewProjection * vec4(aVertexPosition0.xyz, 1.0);
  highp vec4 vertex = vec4(centerVertex.xyz + radius * cornerDirection, 1.0);

  highp vec4 eyeSpacePos = viewMatrix * vertex;
  vPoint = eyeSpacePos.xyz;

  highp vec4 tmppos = viewMatrix * vec4(centerVertex.xyz, 1.0);
	vSphereCenter = tmppos.xyz;

  gl_Position =  projectionMatrix * viewMatrix * vertex;
  //gl_Position = uModelViewProjection * vertex;
  //gl_Position = vertex;
}
`);
//    builder.addFragmentCode(` 
//vec4 computeColorFromLight(const in vec3 normalDirection, const in int lightIdx, const in vec3 position,
//      const in float materialShininess, const in vec4 materialAmbient, const in vec4 materialSpecular,
//      const in vec4 color)
//{
//  vec3 lightDirection;
//  float attenuation = 1.0;
//
//  lightDirection = normalize(vec4(1.0, 1.0, 1.0, 0.0).xyz);
//
//  vec4 retVal = vec4(0.);
//  retVal += vec4(1.0, 1.0, 1.0, 1.0)/*lights_ambient*/ * materialAmbient;
//  float NdotL = dot(normalDirection, lightDirection);
//  if (NdotL > 0.0) {
//    retVal += attenuation * vec4(0.5, 0.5, 0.5, 0.5)/*lights_diffuse*/ * NdotL * color;
//    vec3 cameraDirection = normalize(-position);
//    float NdotH = max(dot(reflect(-lightDirection,normalDirection), cameraDirection), 0.0);
//    retVal += attenuation * vec4(0.3, 0.3, 0.3, 0.5)/*lights_specular*/ * materialSpecular * pow(NdotH, materialShininess);
//  }
//  return retVal;
//}
//
//vec4 apply_lighting_and_fog(const in vec4 sceneAmbient,
//  const in float materialShininess, const in vec4 materialAmbient, const in vec4 materialSpecular,
//  const in vec3 normalDirection, const in vec3 position, const in vec4 color, const in float alpha)
//{
//  vec4 finalColor = sceneAmbient * materialAmbient;
//  
//  finalColor += computeColorFromLight(normalDirection, 0, position, materialShininess, materialAmbient, materialSpecular, color);
//  
//  return vec4(finalColor.rgb * color.a * alpha, color.a * alpha);
//}
//
//    `)


  }

  draw(shader: ShaderProgram, numInstances: number) {
    this.vertexBuffer =
        this.registerDisposer(getMemoizedBuffer( shader.gl, WebGL2RenderingContext.ARRAY_BUFFER, getSphereVertexArray, numInstances))
            .value;
    const aFlag = shader.attribute('aFlag');
    this.vertexBuffer.bindToVertexAttrib(
        aFlag, /*components=*/1, /*attributeType=*/WebGL2RenderingContext.FLOAT,
        /*normalized=*/false, 4);
    this.indexBuffer.bind();
    shader.gl.drawElementsInstanced(
        WebGL2RenderingContext.TRIANGLES, this.numIndices, WebGL2RenderingContext.UNSIGNED_BYTE,
        /*offset=*/0, numInstances);
    shader.gl.disableVertexAttribArray(aFlag);
  }
}
