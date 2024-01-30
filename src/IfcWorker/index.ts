/* eslint-disable @typescript-eslint/no-explicit-any */
import * as OBC from 'openbim-components'
import { DataConverterSignal, IIfcGeometries, IIfcProperties, IfcGeometriesSignal, IfcPropertiesSignal, disposeSignal } from './Signal';
import { effect } from '@preact/signals-react';
import { Culling } from '.';
import * as FRAG from "bim-fragment";
export * from './Signal'
export * from './Culling'
const IfcGeometryWorkerPath = "./IfcGeometryWorker.js";
const IfcPropertyWorkerPath = "./IfcPropertyWorker.js";






export class IfcWorker extends OBC.Component<Worker> implements OBC.Disposable {
  enabled = true;
  private readonly _DataConverterSignal: DataConverterSignal;

  get( ..._args: any ): Worker {
    throw new Error( 'Method not implemented.' );
  }
  /**
   *
   */
  constructor( components: OBC.Components ) {
    super( components );
    this._DataConverterSignal = new DataConverterSignal();
  }
  onDisposed!: OBC.Event<any>;
  async dispose() {
    disposeSignal()
    this.setupEvent = false
  }

  private async onMessage( dataArray: Uint8Array ) {
    const geometryWorker = new Worker( IfcGeometryWorkerPath )
    geometryWorker.postMessage( dataArray );

    const propertyWorker = new Worker( IfcPropertyWorkerPath )
    propertyWorker.postMessage( dataArray );

    geometryWorker.onmessage = async ( e: any ) => {
      const { items, coordinationMatrix, error } = e.data
      if ( error ) return
      IfcGeometriesSignal.value = { items, coordinationMatrix } as IIfcGeometries
    }
    propertyWorker.onmessage = async ( e: any ) => {
      const { error, categories, uuid, ifcMetadata, properties, itemsByFloor } = e.data
      if ( error ) return
      IfcPropertiesSignal.value = { categories, uuid, ifcMetadata, properties, itemsByFloor } as IIfcProperties
    }
    effect( async () => {
      if ( !IfcGeometriesSignal.value || !IfcPropertiesSignal.value ) return;
      const model = await this._DataConverterSignal.generate( IfcGeometriesSignal.value, IfcPropertiesSignal.value )
      const scene = this.components.scene.get()
      scene.add( model )
      this.updateCuller( model )
      geometryWorker.terminate();
      propertyWorker.terminate();
      this._DataConverterSignal.cleanUp()
      IfcGeometriesSignal.value = null
      IfcPropertiesSignal.value = null
    } )

  }
  loadModel = () => {
    const input = document.createElement( "input" );
    input.setAttribute( "type", "file" );
    input.setAttribute( "accept", `.ifc` );
    input.click();
    input.onchange = async ( e: any ) => {
      const file = e.target?.files[0] as File;
      const buffer = await file.arrayBuffer()
      const dataArray = new Uint8Array( buffer );
      this.onMessage( dataArray )
    };
    input.remove();
  }
  private async updateCuller( model: FRAG.FragmentsGroup ) {
    const culling = await this.components.tools.get( Culling )
    if ( !culling ) return
    culling.addModel( model )
    this.setupEvent = true
  }
  set setupEvent( enabled: boolean ) {
    const controls = ( this.components.camera as OBC.SimpleCamera ).controls
    const domElement = ( this.components.renderer as OBC.PostproductionRenderer ).get().domElement
    if ( !controls ) return
    if ( enabled ) {
      controls.addEventListener( "control", this.updateCulling );
      controls.addEventListener( "controlstart", this.updateCulling );
      controls.addEventListener( "wake", this.updateCulling );
      controls.addEventListener( "controlend", this.updateCulling );
      controls.addEventListener( "sleep", this.updateCulling );
      domElement.addEventListener( "wheel", this.updateCulling );
    } else {
      controls.removeEventListener( "control", this.updateCulling );
      controls.removeEventListener( "controlstart", this.updateCulling );
      controls.removeEventListener( "wake", this.updateCulling );
      controls.removeEventListener( "controlend", this.updateCulling );
      controls.removeEventListener( "sleep", this.updateCulling );
      domElement.removeEventListener( "wheel", this.updateCulling );
    }
  }
  updateCulling = async () => {
    const culling = await this.components.tools.get( Culling )
    if ( !culling ) return
    culling.needsUpdate = true
  }
}
