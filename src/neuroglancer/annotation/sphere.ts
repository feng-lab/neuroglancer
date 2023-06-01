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
ng_sphereRadius = 0.3;
float modelPosition[${rank}] = getVertexPosition0();
${this.invokeUserMain}
${this.invokeColorCode}
emitSphere(uProjection, uView, uModel, ng_sphereRadius, modelPosition);
${this.setPartIndex(builder)};
`);
  }

  private defineFragment(builder: ShaderBuilder, rank: number) {
    const frag3d = `
    float dist = b - sqrt(position);
    vec3 ipoint = dist * rayDirection + rayOrigin;
    vec2 clipZW = ipoint.z * uProjection[2].zw + uProjection[3].zw;
    
    float depth = 0.5 + 0.5 * clipZW.x / clipZW.y;
    
    if (depth <= 0.0)
      discard;
    if (depth >= 1.0)
      discard;
    
    vec3 normalDirection = normalize(ipoint - vSphereCenter);
    out_color = apply_lighting_and_fog(vec4(0.5, 0.5, 0.5, 0.5), vMaterialShiniess, vec4(0.1, 0.1, 0.1, 1.0), vMaterialSpecular, normalDirection, ipoint, vec4(vColor.xyz, 1.0), 1.0);
    `;
    const frag2d = `
      out_color = vec4(vColor.rgb, 1.0);
    `;
    builder.setFragmentMain(`
      vec3 rayOrigin = vPoint;
      vec3 rayDirection = normalize(vPoint);
    
      vec3 sphereVector = vSphereCenter - rayOrigin;
      float b = dot(sphereVector, rayDirection);
    
      float position = b * b + vRadius2 - dot(sphereVector, sphereVector);
    
      if (position < 0.0)
        discard;
      ${rank === 3 ? frag3d : frag2d}
      emit(out_color, vPickID);
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
        this.sphereRenderHelper.defineShader(builder);
        builder.addUniform('highp mat4', 'uProjection');
        builder.addUniform('highp mat4', 'uView');
        builder.addUniform('highp mat4', 'uModel');
        this.defineShader(builder)
        this.defineFragment(builder, extraDim);
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
    //const uProjection = new Float32Array([
    //  1.81066, 0.0, 0.0, 0.0,
    //  0.0, 2.41421, 0.0, 0.0,
    //  0.0, 0.0, -1.0202, -1.0,
    //  0.0, 0.0, -2.0202, 0.0
    //])

    const uView = new Float32Array([
       1.0, 0.0, -0.0, 0.0,
       0.0, -1.0, -0.0, 0.0,
       -0.0, 0.0, -1.0, 0.0,
       -0.0, -0.0, -2.0, 1.0
    ])
    const uModel = new Float32Array(16).fill(1);
     this.enable(shaderGetter, context, shader => {
       const { gl } = shader;
       console.log('view Matrix', context.viewMatrix);
       gl.uniformMatrix4fv(
         shader.uniform('uProjection'), 
         /*transpose=*/ false, 
         //uProjection);
         context.projectionMatrix);
       gl.uniformMatrix4fv(
         shader.uniform('uView'), 
         /*transpose=*/ false, 
         uView);
         //context.viewMatrix);
       gl.uniformMatrix4fv(
         shader.uniform('uModel'), 
         /*transpose=*/ false, 
         uModel);
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
