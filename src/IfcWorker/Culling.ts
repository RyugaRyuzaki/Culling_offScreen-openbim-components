import * as THREE from "three";
import * as OBC from "openbim-components";
import * as FRAG from "bim-fragment";

interface IMaterial {
    r: number,
    g: number,
    b: number,
    transparent?: boolean,
    opacity?: number,
}
interface IGeometry {
    position: Float32Array,
    groups?: any[],
    indices?: Uint16Array,
}
interface IInstanceMatrix {
    array: Float32Array,
    normalized: boolean,
    itemSize: number,
    meshPerAttribute: number,
}
interface IInstanceMesh {
    material: IMaterial[] | IMaterial,
    geometry: IGeometry,
    count: number,
    instanceMatrix?: IInstanceMatrix,
    meshMatrix: number[],
}
/**
 * A tool to handle big scenes efficiently by automatically hiding the objects
 * that are not visible to the camera.
 */
export class Culling
    extends OBC.Component<any>
    implements OBC.Disposable {
    static readonly uuid = "69f2a50d-c266-44fc-b1bd-fa4d34be89e6" as const;
    /** {@link Disposable.onDisposed} */
    readonly onDisposed = new OBC.Event<string>();

    /** Fires after hiding the objects that were not visible to the camera. */
    readonly onViewUpdated = new OBC.Event();

    /** {@link Component.enabled} */
    enabled = true;

    /**
     * Needs to check whether there are objects that need to be hidden or shown.
     * You can bind this to the camera movement, to a certain interval, etc.
     */
    needsUpdate = false


    /**
     * {@link Component.get}.
     * @returns the map of internal meshes used to determine visibility.
     */
    get() {
        throw Error( "No need!" )
    }


    private _meshColorMap = new Map<string, THREE.Mesh | THREE.InstancedMesh>();
    private _visibleMeshes: THREE.Mesh[] = [];
    private _meshes = new Map<string, THREE.Mesh>();

    private _currentVisibleMeshes = new Set<string>();
    private _recentlyHiddenMeshes = new Set<string>();


    private _colors = { r: 0, g: 0, b: 0, i: 0 };
    private worker!: Worker
    private static rtWidth = 512
    private static rtHeight = 512
    // Alternative scene and meshes to make the visibility check
    constructor( components: OBC.Components ) {
        super( components )
        this.initWorkers()
    }
    /** {@link Disposable.dispose} */
    async dispose() {
        this.enabled = false;
        this._currentVisibleMeshes.clear();
        this._recentlyHiddenMeshes.clear();
        this._meshColorMap.clear();
        this._visibleMeshes = [];
        this.worker?.terminate();
        this._meshes.clear();
        await this.onDisposed.trigger( Culling.uuid );
        this.onDisposed.reset();
    }
    private initWorkers( updateInterval = 500 ) {
        this.worker = new Worker( './CullingWorker.js' );
        const canvas = document.createElement( 'canvas' )
        const offScreenCanvas = canvas.transferControlToOffscreen();
        offScreenCanvas.width = Culling.rtWidth
        offScreenCanvas.height = Culling.rtHeight
        this.worker.postMessage( { command: "init", dataSend: offScreenCanvas, pixel: window.devicePixelRatio }, [offScreenCanvas] )
        this.worker.addEventListener( "message", this.handleWorkerMessage );
        window.setInterval( this.updateVisibility, updateInterval );
    }
    addModel( model: FRAG.FragmentsGroup ) {
        const instances: IInstanceMesh[] = []
        for ( const mesh of model.children ) {
            const instance = this.add( mesh as THREE.InstancedMesh )
            if ( !instance ) continue
            instances.push( instance )
        }
        this.worker.postMessage( { command: "addModel", dataSend: instances } )
        this.needsUpdate = true
    }
    /**
     * Adds a new mesh to be processed and managed by the culler.
     * @mesh the mesh or instanced mesh to add.
     */
    add( mesh: THREE.Mesh | THREE.InstancedMesh, isInstanced = true ): IInstanceMesh | null {
        if ( !this.enabled ) return null;

        const { geometry, material } = mesh;

        const { r, g, b, code } = this.getNextColor();

        const colorMaterial = { r, g, b } as IMaterial;

        let newMaterial: IMaterial[] | IMaterial;

        if ( Array.isArray( material ) ) {
            let transparentOnly = true;
            const matArray: IMaterial[] = [];

            for ( const mat of material ) {
                if ( this.isTransparent( mat ) ) {
                    const newColor = { ...colorMaterial }
                    newColor.transparent = true
                    newColor.opacity = 0
                    matArray.push( newColor );
                } else {
                    transparentOnly = false;
                    matArray.push( colorMaterial );
                }
            }

            // If we find that all the materials are transparent then we must remove this from analysis
            if ( transparentOnly ) {
                return null;
            }

            newMaterial = matArray;
        } else if ( this.isTransparent( material ) ) {
            // This material is transparent, so we must remove it from analysis
            return null;
        } else {
            newMaterial = colorMaterial;
        }

        this._meshColorMap.set( code, mesh );
        //@ts-ignore
        const count = isInstanced ? mesh.count : 1 as number;
        const position = geometry.attributes.position.array as Float32Array
        const groups = geometry.groups
        const indices = geometry.index?.array as Uint16Array
        const iGeometry = { position, groups, indices } as IGeometry
        const meshMatrix = mesh.matrix.elements
        const instanceMesh = { geometry: iGeometry, material: newMaterial, count, meshMatrix } as IInstanceMesh
        if ( isInstanced ) {
            //@ts-ignore
            const { array, normalized, itemSize, meshPerAttribute } = mesh.instanceMatrix
            instanceMesh.instanceMatrix = { array, normalized, itemSize, meshPerAttribute } as IInstanceMatrix
        }


        mesh.visible = false;
        this._meshes.set( mesh.uuid, mesh );
        return instanceMesh
    }
    private before = 0
    updateVisibility = async () => {
        if ( !this.enabled ) return;
        if ( !this.needsUpdate ) return;
        this.before = performance.now()
        const camera = this.components.camera.get();
        camera.updateMatrix();
        const cameraData = {
            quaternion: camera.quaternion.toArray(),
            position: camera.position.toArray()
        };

        this.worker.postMessage( { command: "update", dataSend: cameraData } )
        this.needsUpdate = false;
    };
    private handleWorkerMessage = async ( event: MessageEvent ) => {
        const colors = event.data.colors as Set<string>;
        this._recentlyHiddenMeshes = new Set( this._currentVisibleMeshes );
        this._currentVisibleMeshes.clear();

        this._visibleMeshes = [];

        // Make found meshes visible
        for ( const code of colors.values() ) {
            const mesh = this._meshColorMap.get( code );
            if ( mesh ) {
                this._visibleMeshes.push( mesh );
                mesh.visible = true;
                this._currentVisibleMeshes.add( mesh.uuid );
                this._recentlyHiddenMeshes.delete( mesh.uuid );
            }
        }

        // // Hide meshes that were visible before but not anymore
        for ( const uuid of this._recentlyHiddenMeshes ) {
            const mesh = this._meshes.get( uuid );
            if ( mesh === undefined ) continue;
            mesh.visible = false;
        }
        console.log( `Time:${( performance.now() - this.before ) / 1000}s` );
    };



    private isTransparent( material: THREE.Material ) {
        return material.transparent && material.opacity < 1;
    }

    private getNextColor() {
        if ( this._colors.i === 0 ) {
            this._colors.b++;
            if ( this._colors.b === 256 ) {
                this._colors.b = 0;
                this._colors.i = 1;
            }
        }

        if ( this._colors.i === 1 ) {
            this._colors.g++;
            this._colors.i = 0;
            if ( this._colors.g === 256 ) {
                this._colors.g = 0;
                this._colors.i = 2;
            }
        }

        if ( this._colors.i === 2 ) {
            this._colors.r++;
            this._colors.i = 1;
            if ( this._colors.r === 256 ) {
                this._colors.r = 0;
                this._colors.i = 0;
            }
        }

        return {
            r: this._colors.r,
            g: this._colors.g,
            b: this._colors.b,
            code: `${this._colors.r}-${this._colors.g}-${this._colors.b}`,
        };
    }
}


OBC.ToolComponent.libraryUUIDs.add( Culling.uuid );