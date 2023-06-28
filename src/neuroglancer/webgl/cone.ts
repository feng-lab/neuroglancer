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
 * @file Facilities for drawing spheres in WebGL
 */

import { RefCounted } from 'neuroglancer/util/disposable';
import { Buffer, getMemoizedBuffer } from 'neuroglancer/webgl/buffer';
import { GL } from 'neuroglancer/webgl/context';
import { ShaderBuilder, ShaderProgram } from 'neuroglancer/webgl/shader';
import { glsl_emitCone, glsl_emitConeFrag } from './coneSource';

export function getConeVertexArray(count: number) {
  const totalNum = count * 4;
  const result = new Float32Array(totalNum);
  for (let i = 0; i <= count; i++) {
    result[i * 4] = 0;
    result[i * 4 + 1] = 32;
    result[i * 4 + 2] = 2;
    result[i * 4 + 3] = 34;
  }
  return result;
}

export function getConeIndexArray() {
  return new Uint8Array([
    0, 1, 2,
    2, 1, 3
  ]);
}


export class ConeRenderHelper extends RefCounted {
  private vertexBuffer: Buffer;
  private indexBuffer: Buffer;
  private numIndices: number;

  constructor(gl: GL) {
    super();

    this.indexBuffer =
      this.registerDisposer(getMemoizedBuffer(
        gl, WebGL2RenderingContext.ELEMENT_ARRAY_BUFFER,
        getConeIndexArray))
        .value;
    this.numIndices = 6;
  }

  defineShader(builder: ShaderBuilder) {
    builder.addAttribute("highp float", "aFlag");

    builder.addVarying("highp vec3", "vPoint");
    builder.addVarying("highp vec3", "vAxis");
    builder.addVarying("highp vec3", "vBase");
    builder.addVarying("highp vec3", "vTop");
    builder.addVarying("highp vec3", "vU");
    builder.addVarying("highp vec3", "vV");
    builder.addVarying("highp vec4", "vCombo1");
    builder.addVarying("highp vec4", "vBaseColor");
    builder.addVarying("highp vec4", "vTopColor");

    //vertex
    builder.addUniform("highp mat4", "uViewMatrix");
    builder.addUniform("highp mat4", "uProjectionViewMatrix");
    builder.addUniform("highp mat4", "uProjectionMatrixInverse");
    builder.addUniform("highp mat3", "uNormalMatrix");
    builder.addUniform("highp mat4", "uModelMatrix");

    //fragment
    builder.addUniform("highp float", "uOrtho");
    builder.addUniform("highp float", "uAlpha");
    builder.addUniform("highp mat4", "uProjectionMatrix");

    builder.addOutputBuffer("vec4", "fragColor", 3);
    builder.addOutputBuffer("float", "fragDepth", 4);


    builder.addVertexCode(`
    #define vBaseRadius vCombo1.x
    #define vTopRadius vCombo1.y
    #define vHeight vCombo1.z
    #define vInvSqrHeight vCombo1.w

    //uniform float uSizeScale = 1.0;
    //uniform mat4 uPosTransform = mat4(1.0);
    ${glsl_emitCone}
    `);

    builder.addFragmentCode(`
    //#define FragData0 gl_FragData[0]
    //uniform float uOrtho = 1.;
    //uniform vec4 uSceneAmbient = vec4(0.2, 0.2, 0.2, 1.);
    //uniform vec4 uMaterialAmbient = vec4(0.1, .1, .1, 1.);
    //uniform vec4 uMaterialSpecular = vec4(1., 1., 1., 1.);
    //uniform float uMaterialShininess = 100.;

    #define vBaseRadius vCombo1.x
    #define vTopRadius vCombo1.y
    #define vHeight vCombo1.z
    #define vInvSqrHeight vCombo1.w
    ${glsl_emitConeFrag}

    `)

  }


  draw(shader: ShaderProgram, numInstances: number) {
    this.vertexBuffer =
      this.registerDisposer(getMemoizedBuffer(shader.gl, WebGL2RenderingContext.ARRAY_BUFFER, getConeVertexArray, numInstances))
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
