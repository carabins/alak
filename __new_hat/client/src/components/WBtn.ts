import {LayoutBase, wrapUI} from "@alaq/flex";
import {Geometry, Mesh, Shader} from 'pixi.js'


import vertex from './x.vert?raw';
import source from './x.wgsl?raw';
import fragment from './x.frag?raw';
import waveFragment from './wave.frag?raw';



export class XBtn extends LayoutBase {
  private _mesh: Mesh;

  constructor(props) {
    super(props);
    const quadGeometry = new Geometry({
      attributes: {
        aPosition: [
          -100, -100, // x, y
           100, -100, // x, y
           100,  100, // x, y
          -100,  100, // x, y
        ],
        aUV: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });

    const gl = { vertex, fragment };
    const gpu = {
      vertex: {
        entryPoint: 'main',
        source,
      },
      fragment: {
        entryPoint: 'main',
        source,
      },
    };
    const shader = Shader.from({
      gl,
      gpu,
    })
    const waveShader = Shader.from({
      gl: {
        vertex,
        // Third effect
        fragment: waveFragment,
      },
      resources: {
        waveUniforms: {
          amplitude: { type: 'f32', value: 0.75 },
          time: { type: 'f32', value: 0 },
        },
      },
    });
    this._mesh = new Mesh({
      geometry: quadGeometry,
      shader:waveShader,
    });
    this.addChild(this._mesh);
  }

  layout(w?: number, h?: number) {
    // Use explicit size if set, otherwise use provided size, otherwise default
    const finalW = (this._explicitWidth !== undefined) ? this._explicitWidth : (w ?? 200);
    const finalH = (this._explicitHeight !== undefined) ? this._explicitHeight : (h ?? 60);

    super.layout(finalW, finalH);

    if (this._mesh) {
        // Resize mesh to fit the layout box
        this._mesh.width = finalW;
        this._mesh.height = finalH;

        // Since our geometry is centered at 0,0, and Flex layout expects 0,0 to be top-left,
        // we need to move the mesh to the center of the box.
        this._mesh.position.set(finalW / 2, finalH / 2);
    }
  }
}

// export const XBtn = x
