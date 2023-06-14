/**
 * @license
 * Copyright 2018 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file Support for rendering point annotations.
 */

import {AnnotationType, Sphere} from 'neuroglancer/annotation';
import {AnnotationRenderContext, AnnotationRenderHelper, AnnotationShaderGetter, registerAnnotationTypeRenderHandler} from 'neuroglancer/annotation/type_handler';
import {ShaderBuilder, ShaderProgram} from 'neuroglancer/webgl/shader';
import {defineVectorArrayVertexShaderInput} from 'neuroglancer/webgl/shader_lib';
import { AtlasSphereRenderHelper } from '../webgl/atlasSpheres';
import { vec3 } from '../util/geom';
import { defineLightingShader, setLightingShader } from '../webgl/lighting';

class RenderHelper extends AnnotationRenderHelper {
  private sphereRenderHelper = this.registerDisposer(new AtlasSphereRenderHelper(this.gl));

  private defineShader(builder: ShaderBuilder) {
    const {rank} = this;
    // Position of point in model coordinates.
    defineVectorArrayVertexShaderInput(
        builder, 'float', WebGL2RenderingContext.FLOAT, /*normalized=*/ false, 'VertexPosition',
        rank);
    builder.addVertexCode(`
float ng_sphereRadius;
void setSphereRadius(float radius) {
  ng_sphereRadius = radius;
}
void setSphereColor(vec4 color) {
  vColor = color;
}
`);
    builder.addVertexMain(`
ng_sphereRadius = 0.001 + uRadiusCoefficient;
float modelPosition[${rank}] = getVertexPosition0();
${this.invokeUserMain}
${this.invokeColorCode}
emitSphere(uProjection, uView, uModel, ng_sphereRadius, modelPosition, uBoxCorrection);
${this.setPartIndex(builder)};
`);
  }

  private defineFragment(builder: ShaderBuilder) {
    builder.setFragmentMain(`
highp vec3 rayOrigin = vPoint;
//highp vec3 rayDirection = normalize(vPoint);
highp vec3 rayDirection = mix(normalize(vPoint), vec3(0.0, 0.0, -1.0), uOrtho);
    
highp vec3 sphereVector = vSphereCenter - rayOrigin;
highp float b = dot(sphereVector, rayDirection);
    
highp float position = b * b + vRadius2 - dot(sphereVector, sphereVector);
    
if (position < 0.0)
  discard;
highp float dist = b - sqrt(position);
highp vec3 ipoint = dist * rayDirection + rayOrigin;
highp vec2 clipZW = ipoint.z * uProjection[2].zw + uProjection[3].zw;
    
highp float depth = 0.5 + 0.5 * clipZW.x / clipZW.y;
    
if (depth <= 0.0)
  discard;
if (depth >= 1.0)
  discard;
    
highp vec3 normalDirection = normalize(ipoint - vSphereCenter);
//out_color = apply_lighting_and_fog(vec4(0.5, 0.5, 0.5, 0.5), vMaterialShiniess, vec4(0.1, 0.1, 0.1, 1.0), vMaterialSpecular, normalDirection, ipoint, vec4(vColor.xyz, 1.0), 1.0);
//out_color = apply_lighting_and_fog(vec4(0.2, 0.2, 0.2, 1.0), 100.0, vec4(0.1, 0.1, 0.1, 1.0), vec4(1.0, 1.0, 1.0, 1.0), normalDirection, ipoint, vColor, 1.0);
vec4 color = apply_lighting_and_fog(vec4(0.2, 0.2, 0.2, 1.0), 100.0, vec4(0.1, 0.1, 0.1, 1.0), vec4(1.0, 1.0, 1.0, 1.0), normalDirection, ipoint, vColor, 1.0);
emit(color, vPickID);
    `)
    


  }

  get invokeColorCode() {
    return this.isInvokePropertyCode("sphereColor") ? 
    `
      setSphereColor(a_prop_sphereColor);
    ` : "";
  }

  private makeShaderGetter = (extraDim: number) => 
      this.getDependentShader(`annotation/sphere:${extraDim}d`, (builder: ShaderBuilder) => {
        //builder.addFragmentCode(`
        //${gsls_LIGHTING}
        //`);
        defineLightingShader(builder);
        this.sphereRenderHelper.defineShader(builder);
        builder.addUniform('highp mat4', 'uProjection');
        builder.addUniform('highp mat4', 'uView');
        builder.addUniform('highp mat4', 'uModel');
        builder.addUniform('highp float', 'uRadiusCoefficient');
        this.defineShader(builder)
        this.defineFragment(builder);
      });

  enable(
      shaderGetter: AnnotationShaderGetter, context: AnnotationRenderContext,
      callback: (shader: ShaderProgram) => void) {
    this.shaderControlState.builderState.value.referencedProperties = ["sphereColor"];
    super.enable(shaderGetter, context, shader => {
      const binder = shader.vertexShaderInputBinders['VertexPosition'];
      binder.enable(1);
      this.gl.bindBuffer(WebGL2RenderingContext.ARRAY_BUFFER, context.buffer.buffer);
      binder.bind(this.geometryDataStride, context.bufferOffset);
      callback(shader);
      binder.disable();
    });
  }

  draw(context: AnnotationRenderContext) {
    const {numChunkDisplayDims} = context.chunkDisplayTransform;
    const shaderGetter = this.makeShaderGetter(numChunkDisplayDims);

    this.enable(shaderGetter, context, shader => {
      const { gl } = shader;
      const { viewMatrix, projectionMat, displayDimensionRenderInfo } = context.projectionParameters;
      const rightVector = vec3.fromValues(viewMatrix[0], viewMatrix[1], viewMatrix[2]);
      const upVector = vec3.fromValues(viewMatrix[4], viewMatrix[5], viewMatrix[6]);
      const rightLength = vec3.length(rightVector);
      const upLength = vec3.length(upVector);
      const invRightLength = 1/rightLength;
      const invUpLength = 1/upLength;

      const radiusCoefficient = Math.floor(
        Math.log10(displayDimensionRenderInfo.canonicalVoxelPhysicalSize) - (-9)) * 1e-3;

      gl.uniformMatrix4fv(shader.uniform('uProjection'), /*transpose=*/ false, projectionMat);
      gl.uniformMatrix4fv(shader.uniform('uView'), /*transpose=*/ false, viewMatrix);
      gl.uniformMatrix4fv(shader.uniform('uModel'), /*transpose=*/ false, context.renderSubspaceModelMatrix);
      gl.uniform1f(shader.uniform("uRadiusCoefficient"), radiusCoefficient);
      gl.uniform1f(
        shader.uniform('uBoxCorrection'), 
        1.2 * invRightLength * invUpLength
        * context.renderSubspaceInvModelMatrix[0]  //modelx scale
        * context.renderSubspaceInvModelMatrix[5]  //modely scale
        * context.renderSubspaceInvModelMatrix[10] //modelz scale
      );
      const ortho = this.targetIsSliceView ? 1.0 : 0.0;
      gl.uniform1f(shader.uniform("uOrtho"), ortho);
      setLightingShader(shader, true);
      this.sphereRenderHelper.draw(shader, context.count);
    })
  }
}

registerAnnotationTypeRenderHandler<Sphere>(AnnotationType.SPHERE, {
  sliceViewRenderHelper: RenderHelper,
  perspectiveViewRenderHelper: RenderHelper,
  defineShaderNoOpSetters(builder) {
    builder.addVertexCode(`
void setSphereRadius(float size) {}
void setSphereColor(vec4 color) {}
`);
  },
  pickIdsPerInstance: 1,
  snapPosition(position, data, offset) {
    position.set(new Float32Array(data, offset, position.length));
  },
  getRepresentativePoint(out, ann) {
    out.set(ann.center);
  },
  updateViaRepresentativePoint(oldAnnotation, position) {
    return {...oldAnnotation, center: new Float32Array(position)};
  }
});
