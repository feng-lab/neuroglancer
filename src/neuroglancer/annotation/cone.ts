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
 * @file Support for rendering ellipsoid annotations.
 */

import {AnnotationType, Cone} from 'neuroglancer/annotation';
import {AnnotationRenderContext, AnnotationRenderHelper, AnnotationShaderGetter, registerAnnotationTypeRenderHandler} from 'neuroglancer/annotation/type_handler';
import {mat3, mat4 } from 'neuroglancer/util/geom';
import {ShaderBuilder, ShaderProgram} from 'neuroglancer/webgl/shader';
import {defineVectorArrayVertexShaderInput} from 'neuroglancer/webgl/shader_lib';
import { ConeRenderHelper } from '../webgl/cone';
import { mat3FromMat4 } from 'neuroglancer/util/geom';
import { defineLightingShader, setLightingShader } from '../webgl/lighting';
import { PerspectiveViewRenderContext } from 'neuroglancer/perspective_view/render_layer';
//import { scaleMat3Output } from 'neuroglancer/util/geom';

const FULL_OBJECT_PICK_OFFSET = 0;
const ENDPOINTS_PICK_OFFSET = FULL_OBJECT_PICK_OFFSET + 1;
const PICK_IDS_PER_INSTANCE = ENDPOINTS_PICK_OFFSET + 2;


class RenderHelper extends AnnotationRenderHelper {
  private coneRenderHelper = this.registerDisposer(new ConeRenderHelper(this.gl));

  defineShader(builder: ShaderBuilder) {
    const {rank} = this;
    defineVectorArrayVertexShaderInput(
        builder, 'float', WebGL2RenderingContext.FLOAT, /*normalized=*/ false, 'CenterAndRadius',
        rank+1, 2);
    this.coneRenderHelper.defineShader(builder);
    builder.addVertexCode(`

void setConeBaseColor(vec4 color) {
  vBaseColor = color;
}
void setConeTopColor(vec4 color) {
  vTopColor = color;
}
void setConeColor(vec4 color) {
  vBaseColor = color;
  vTopColor = color;
}
void setConeBaseRadius(float baseRadius) {
  bradius = baseRadius * uRadiusScale;
}
void setConeTopRadius(float topRadius) {
  tradius = topRadius * uRadiusScale;
}
`);

  }


  get invokeColorCode() {
    let code = "";
    if(this.isInvokePropertyCode("coneColor")) {
      code += ` 
        setConeColor(a_prop_coneColor);
      `
    }
    if(this.isInvokePropertyCode("coneTopColor")) {
      code += `
        setConeTopColor(a_prop_coneTopColor);
      `
    }
    if(this.isInvokePropertyCode("coneBaseColor")) {
      code += `
        setConeBaseColor(a_prop_coneBaseColor);
      `
    }
    return code;
  }

  get invokeRadiusCode() {
    let code = "";
    if(this.isInvokePropertyCode("coneBaseRadius")) {
      code += `
        setConeBaseRadius(a_prop_coneBaseRadius);
      `
    }
    if(this.isInvokePropertyCode("coneTopRadius")) {
      code += `
        setConeBaseRadius(a_prop_coneTopRadius);
      `
    }
    return code;
  }

  private shaderGetter =
      this.getDependentShader('annotation/cone', (builder: ShaderBuilder) => {
        defineLightingShader(builder);
        this.defineShader(builder);
        builder.addVertexCode(`
          void setPartIndex() {
            highp uint pickID = uPickID;
            highp uint pickBaseOffset = getPickBaseOffset();
            highp uint pickOffset0 = pickBaseOffset;
            vPickID = pickID + pickOffset0;
            highp uint selectedIndex = uSelectedIndex;
            if (selectedIndex == pickBaseOffset) {
              vBaseColor = vec4(mix(vBaseColor.rgb, vec3(1.0, 1.0, 1.0), 0.75), vBaseColor.a);
              vTopColor = vec4(mix(vTopColor.rgb, vec3(1.0, 1.0, 1.0), 0.75), vTopColor.a);
            }
          }
        `)
        builder.setVertexMain(`
          // bradius = aCenterAndRadius0.w * uRadiusScale;
          // tradius = aCenterAndRadius1.w * uRadiusScale;
          // bradius = 2.0 * uRadiusScale;
          // tradius = 2.0 * uRadiusScale;
          ${this.invokeRadiusCode}
          ${this.invokeUserMain}
          ${this.invokeColorCode}
          // emitCone(vBaseRadius, vTopRadius, aCenterAndRadius0, aCenterAndRadius1);
          emitCone();
          setPartIndex();
        `)
        builder.setFragmentMain(`
          // vec4 fColor = coneFragmentFunc(vBaseRadius, vTopRadius, vInvSqrHeight, vHeight);
          // vec4 fColor = coneFragmentFunc(vCombo1.x, vCombo1.y, vCombo1.w, vCombo1.z);
          vec4 fColor = coneFragmentFunc();
          emitAnnotation(fColor);
        `)
      });

  enable(
      shaderGetter: AnnotationShaderGetter, context: AnnotationRenderContext,
      callback: (shader: ShaderProgram) => void) {
    this.shaderControlState.builderState.value.referencedProperties = ["coneColor", "coneTopColor", "coneBaseColor", "coneBaseRadius", "coneTopRadius"];
    super.enable(shaderGetter, context, shader => {
      const binder = shader.vertexShaderInputBinders['CenterAndRadius'];
      binder.enable(1);
      this.gl.bindBuffer(WebGL2RenderingContext.ARRAY_BUFFER, context.buffer.buffer);
      binder.bind(this.geometryDataStride, context.bufferOffset);
      callback(shader);
      binder.disable();
    });
  }

  draw(context: AnnotationRenderContext) {
    this.enable(this.shaderGetter, context, shader => {
      const {gl} = shader;
      const { viewMatrix, viewProjectionMat, projectionMat, /*displayDimensionRenderInfo*/ baseFactor} = context.projectionParameters; 
      let tempMat4 = mat4.create();
      const projectionInvMatrix = mat4.invert(tempMat4, projectionMat) ?? mat4.create();

      let pqView: mat4 = mat4.create();
      let pqViewProj: mat4 = mat4.create();
      for (let i = 0; i < 3; ++i) {
        pqView[i] *= baseFactor;
        pqView[4 + i] *= baseFactor;
        pqView[8 + i] *= baseFactor; 
        pqView[12 + i] = context.projectionParameters.globalPosition[i]*(1 - baseFactor);
        //pqView[12 + i] = 1 -scale;
      }
      mat4.multiply(pqView, viewMatrix, pqView);
      mat4.multiply(pqViewProj, projectionMat, pqView);

      // gl.uniformMatrix4fv(shader.uniform("uViewMatrix"), false, viewMatrix);
      gl.uniformMatrix4fv(shader.uniform("uViewMatrix"), false, pqView);
      gl.uniformMatrix4fv(shader.uniform("uProjectionMatrix"), false, projectionMat);
      // gl.uniformMatrix4fv(shader.uniform("uProjectionViewMatrix"), false, viewProjectionMat);
      gl.uniformMatrix4fv(shader.uniform("uProjectionViewMatrix"), false, pqViewProj);
      gl.uniformMatrix4fv(
        shader.uniform("uProjectionMatrixInverse"), 
        false, 
        projectionInvMatrix
      );
      const tempMat3 = mat3.create();
      // mat3FromMat4(tempMat3, viewMatrix);
      mat3FromMat4(tempMat3, pqView);
      //scaleMat3Output( tempMat3, tempMat3, displayDimensionRenderInfo.canonicalVoxelFactors);
      mat3.invert(tempMat3, tempMat3);
      mat3.transpose(tempMat3, tempMat3);
      gl.uniformMatrix3fv(shader.uniform('uNormalMatrix'), false, tempMat3);
      const ortho = this.targetIsSliceView ? 1.0 : 0.0;
      gl.uniform1f(shader.uniform("uOrtho"), ortho);
      gl.uniform1f(shader.uniform("uAlpha"), 1.0);

      let pqModel:mat4=mat4.create();
      for (let i = 0; i < 3; ++i) {
          pqModel[i] /= baseFactor;
          pqModel[4 + i] /= baseFactor;
          pqModel[8 + i] /= baseFactor; 
          pqModel[12 + i] = context.projectionParameters.globalPosition[i]*(1-1/baseFactor);
      }

      // gl.uniformMatrix4fv(shader.uniform('uModelMatrix'), /*transpose=*/ false, mat4.multiply(pqModel,pqModel,context.renderSubspaceModelMatrix));
      gl.uniformMatrix4fv(shader.uniform('uModelMatrix'), /*transpose=*/ false, pqModel);
      if (!this.targetIsSliceView) {
        const renderContext = context.renderContext as PerspectiveViewRenderContext;
        // gl.uniform1f(shader.uniform("uRadiusScale"), 1.0/renderContext.perspectiveNavigationState.zoomFactor.value);
        gl.uniform1f(shader.uniform("uRadiusScale"), 2.0*Math.tan(Math.PI / 8.0)/renderContext.perspectiveNavigationState.zoomFactor.value);
        // gl.uniform1f(shader.uniform("uRadiusScale"), renderContext.perspectiveNavigationState.zoomFactor.value);
      }
      setLightingShader(shader, true);
      this.coneRenderHelper.draw(shader, context.count);
    });
  }
}


registerAnnotationTypeRenderHandler<Cone>(AnnotationType.CONE, {
  sliceViewRenderHelper: RenderHelper,
  perspectiveViewRenderHelper: RenderHelper,
  defineShaderNoOpSetters(builder) {
    builder.addVertexCode(`
void setConeBaseColor(vec4 color) {}
void setConeTopColor(vec4 color) {}
void setConeColor(vec4 color) {}
void setConeBaseRadius(float baseRadius) {}
void setConeTopRadius(float topRadius) {}
`);
  },
  pickIdsPerInstance: PICK_IDS_PER_INSTANCE,
  snapPosition: (/*position, annotation, partIndex*/) => {
    // FIXME: snap to nearest point on ellipsoid surface
  },
  getRepresentativePoint(position, ann) {
    //position.set(ann.center);
    console.log('getRepresentativePoint', position, ann);
  },
  updateViaRepresentativePoint(oldAnnotation: Cone, position: Float32Array) {
    //return {...oldAnnotation, center: new Float32Array(position)};
    console.log('updateViaRepresentativePoint', position);
    return oldAnnotation;
  }
});