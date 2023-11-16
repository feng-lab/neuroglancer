import { AnnotationRenderContext, AnnotationRenderHelper, AnnotationShaderGetter, registerAnnotationTypeRenderHandler } from "neuroglancer/annotation/type_handler";
import { AtlasEllipsoidRenderHelper } from "neuroglancer/webgl/atlasEllipsoid";
import { ShaderBuilder, ShaderProgram } from "neuroglancer/webgl/shader";
import { defineVectorArrayVertexShaderInput } from "neuroglancer/webgl/shader_lib";
import { defineLightingShader, setLightingShader } from "neuroglancer/webgl/lighting";
import { mat4 } from "neuroglancer/util/geom";
import {AnnotationType, AtlasEllipsoid } from 'neuroglancer/annotation';

class RenderHelper extends AnnotationRenderHelper {
  private atlasEllipsoidRenderHelper = this.registerDisposer(new AtlasEllipsoidRenderHelper(this.gl));
  private defineShader(builder: ShaderBuilder) {
    const { rank } = this;
    defineVectorArrayVertexShaderInput(
      builder, 
      'float', 
      WebGL2RenderingContext.FLOAT, 
      false, 
      'CenterAndRadiiVector', 
      rank, 
      4);
    builder.addVertexCode(`
void setAtlasEllipsoidColor(vec4 color) {
  vColor = color;
}
    `);
    builder.addVertexMain(`
highp float modelCenter[${rank}] = getCenterAndRadiiVector0();
highp float modelXVector[${rank}] = getCenterAndRadiiVector1();
highp float modelYVector[${rank}] = getCenterAndRadiiVector2();
highp float modelZVector[${rank}] = getCenterAndRadiiVector3();
${this.invokeColorCode}
${this.invokeUserMain}
emitAtlasEllipsoid(uProjectionView, uProjectionInv, uView, modelCenter, modelXVector, modelYVector, modelZVector);
${this.setPartIndex(builder)};

    `);
  }

  private defineFragment(builder: ShaderBuilder) {
    builder.setFragmentMain(`
vec4 color = emitAtlasEllipsoidFragment(uProjection);
emit(color, vPickID);
    `);
  }

  get invokeColorCode() {
    return this.isInvokePropertyCode("atlasEllipsoidColor") ? 
    `
      setAtlasEllipsoidColor(a_prop_atlasEllipsolidColor);
    ` : "";
  }

  private shaderGetter = this.getDependentShader(
    'annotation/atlasEllipsoid', 
    (builder: ShaderBuilder) => {
      defineLightingShader(builder);
      this.atlasEllipsoidRenderHelper.defineShader(builder);
      builder.addUniform('highp mat4', 'uProjection');
      builder.addUniform('highp mat4', 'uProjectionInv');
      builder.addUniform('highp mat4', 'uProjectionView');
      builder.addUniform('highp mat4', 'uView');
      this.defineShader(builder);
      this.defineFragment(builder);
    }
  )

  enable(shaderGetter: AnnotationShaderGetter, context: AnnotationRenderContext, callback: (shader: ShaderProgram) => void): void {
    this.shaderControlState.builderState.value.referencedProperties = ["atlasEllipsoidColor"];
    super.enable(shaderGetter, context, shader => {
      const binder = shader.vertexShaderInputBinders['CenterAndRadiiVector'];
      binder.enable(1);
      this.gl.bindBuffer(WebGL2RenderingContext.ARRAY_BUFFER, context.buffer.buffer);
      binder.bind(this.geometryDataStride, context.bufferOffset);
      callback(shader);
      binder.disable();
    });
  }

  draw(context: AnnotationRenderContext) {
    this.enable(this.shaderGetter, context, shader => {
      const { gl } = shader;
      const { viewMatrix, projectionMat, viewProjectionMat } = context.projectionParameters;
      gl.uniformMatrix4fv(shader.uniform("uProjection"), false, projectionMat);
      gl.uniformMatrix4fv(shader.uniform("uView"), false, viewMatrix);
      gl.uniformMatrix4fv(shader.uniform("uProjectionView"), false, viewProjectionMat);
      const projectInv: mat4 = mat4.create();
      mat4.invert(projectInv, projectionMat);
      gl.uniformMatrix4fv(shader.uniform("uProjectionInv"), false, projectInv);
      setLightingShader(shader, true);
      const ortho = this.targetIsSliceView ? 1.0 : 0.0;
      gl.uniform1f(shader.uniform("uOrtho"), ortho);
      this.atlasEllipsoidRenderHelper.draw(shader, context.count);
    })
  }
}

registerAnnotationTypeRenderHandler<AtlasEllipsoid>(AnnotationType.ATLAS_ELLIPSOID, {
  sliceViewRenderHelper: RenderHelper,
  perspectiveViewRenderHelper: RenderHelper,
  defineShaderNoOpSetters(builder) {
    builder.addVertexCode(`
void setAtlasEllipsoidColor(vec4 color) {}
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