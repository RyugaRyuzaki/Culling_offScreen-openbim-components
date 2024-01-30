import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as OBC from "openbim-components";
import "./App.css";
import { Culling, IfcWorker } from "./IfcWorker";
import Stats from "stats.js";
function App() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		const components = new OBC.Components();
		initScene(components, containerRef.current!);
		return () => {
			components.dispose();
		};
	}, []);

	return <div className="full-screen" ref={containerRef}></div>;
}
async function initScene(components: OBC.Components, container: HTMLDivElement) {
	components.scene = new OBC.SimpleScene(components);
	components.renderer = new OBC.PostproductionRenderer(components, container);
	components.camera = new OBC.SimpleCamera(components);
	components.raycaster = new OBC.SimpleRaycaster(components);

	components.init();
	const scene = components.scene.get();
	(components.renderer as OBC.PostproductionRenderer).postproduction.enabled = true;

	(components.camera as OBC.SimpleCamera).controls.setLookAt(20, 20, 20, 0, 0, 0);
	const directionalLight = new THREE.DirectionalLight();
	directionalLight.position.set(5, 10, 3);
	directionalLight.intensity = 0.5;
	scene.add(directionalLight);

	const ambientLight = new THREE.AmbientLight();
	ambientLight.intensity = 0.5;
	scene.add(ambientLight);
	const grid = new OBC.SimpleGrid(components, new THREE.Color(0x666666));
	components.tools.add("77e3066d-c402-4d77-b3bf-3f1dce9a9576", grid);
	const customEffects = (components.renderer as OBC.PostproductionRenderer).postproduction.customEffects;
	customEffects.excludedMeshes.push(grid.get());
	const toolbar = new OBC.Toolbar(components);
	components.ui.addToolbar(toolbar);
	const ifcWorker = new IfcWorker(components);
	const culling = new Culling(components);
	const cacher = new OBC.FragmentCacher(components);
	//load
	const loadButton = new OBC.Button(components);
	loadButton.materialIcon = "download";
	loadButton.tooltip = "Load model";
	toolbar.addChild(loadButton);

	loadButton.onClick.add(ifcWorker.loadModel);

	const stats = new Stats();
	stats.showPanel(2);
	document.body.append(stats.dom);
	stats.dom.style.left = "0px";
	const renderer = components.renderer as OBC.PostproductionRenderer;
	renderer.onBeforeUpdate.add(() => stats.begin());
	renderer.onAfterUpdate.add(() => stats.end());
}
export default App;

// const fragments = new OBC.FragmentManager(components);
// 	const fragmentIfcLoader = new OBC.FragmentIfcLoader(components);
// 	const excludedCats = [WEBIFC.IFCTENDONANCHOR, WEBIFC.IFCREINFORCINGBAR, WEBIFC.IFCREINFORCINGELEMENT];

// 	for (const cat of excludedCats) {
// 		fragmentIfcLoader.settings.excludedCategories.add(cat);
// 	}

// 	/*MD
//     We can further configure the conversion using the `webIfc` object.
//     In this example, we will make the IFC model go to the origin of
//     the scene (don't worry, this supports model federation) and
//     optimize the profiles geometry so that it generates very
//     efficient geometry for certain geometries (e.g. HVAC):
//     */
// 	fragmentIfcLoader.settings.wasm = {
// 		path: "https://unpkg.com/web-ifc@0.0.50/",
// 		absolute: true,
// 	};
// 	fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;
// 	fragmentIfcLoader.settings.webIfc.OPTIMIZE_PROFILES = true;

// 	const highlighter = new OBC.FragmentHighlighter(components);
// 	(components.renderer as OBC.PostproductionRenderer).postproduction.customEffects.outlineEnabled = true;
// 	highlighter.outlineEnabled = true;

// 	const highlightMaterial = new THREE.MeshBasicMaterial({
// 		color: "#BCF124",
// 		depthTest: false,
// 		opacity: 0.8,
// 		transparent: true,
// 	});

// 	highlighter.add("default", [highlightMaterial]);
// 	highlighter.outlineMaterial.color.set(0xf0ff7a);
// 	const singleSelection = {
// 		value: true,
// 	};
// 	let lastSelection: OBC.FragmentIdMap | null;
// 	const highlightOnClick = async () => {
// 		const result = await highlighter.highlight("default", singleSelection.value);
// 		lastSelection = null;
// 		if (result) {
// 			lastSelection = {};
// 			for (const fragment of result.fragments) {
// 				const fragmentID = fragment.id;
// 				lastSelection[fragmentID] = new Set([result.id]);
// 			}
// 		}
// 	};

// 	container.addEventListener("click", highlightOnClick);
// 	const toolbar = new OBC.Toolbar(components);
// 	components.ui.addToolbar(toolbar);
// 	//load
// 	const loadButton = new OBC.Button(components);
// 	loadButton.materialIcon = "download";
// 	loadButton.tooltip = "Load model";
// 	toolbar.addChild(loadButton);
// 	const loadModel = () => {
// 		const input = document.createElement("input");
// 		input.setAttribute("type", "file");
// 		input.click();
// 		input.addEventListener("change", async (e: any) => {
// 			const file = e.target.files[0];
// 			const data = await file.arrayBuffer();
// 			const buffer = new Uint8Array(data);
// 			const model = await fragmentIfcLoader.load(buffer, "example");
// 			scene.add(model);
// 			highlighter.update();
// 		});
// 		input.remove();
// 	};

// 	loadButton.onClick.add(loadModel);

// 	function transformItem(ids: Set<string>, fragmentID: string, action: "move" | "copy" | "delete") {
// 		const fragment = fragments.list[fragmentID];
// 		if (!fragment) return;
// 		const isBlockFragment = fragment.blocks.count > 1;
// 		fragment.mesh.updateMatrixWorld(true);

// 		if (isBlockFragment) {
// 			const indices = fragment.mesh.geometry.index.array;
// 			const newIndex: number[] = [];
// 			const idsSet = new Set(ids);
// 			for (let i = 0; i < indices.length - 2; i += 3) {
// 				const index = indices[i];
// 				const blockID = fragment.mesh.geometry.attributes.blockID.array;
// 				const block = blockID[index];
// 				const itemID = fragment.mesh.fragment.getItemID(0, block);
// 				if (idsSet.has(itemID)) {
// 					newIndex.push(indices[i], indices[i + 1], indices[i + 2]);
// 				}
// 			}
// 		} else {
// 			for (const id of ids) {
// 				const { instanceID } = fragment.getInstanceAndBlockID(id);
// 				fragment.mesh.getMatrixAt(instanceID, tempMatrix);
// 				const { x, y, z } = actionVector;
// 				const elements = tempMatrix.elements;
// 				elements[12] += x;
// 				elements[13] += y;
// 				elements[14] += z;
// 				fragment.mesh.setMatrixAt(instanceID, tempMatrix);
// 				fragment.mesh.instanceMatrix.needsUpdate = true;
// 				// if (action === "move") {
// 				// 	fragment.mesh.setMatrixAt(instanceID, tempMatrix);
// 				// 	fragment.mesh.instanceMatrix.needsUpdate = true;
// 				// } else if (action === "copy") {
// 				// 	fragment.addInstances([{ ids: Array.from(ids), transform: tempMatrix }]);
// 				// }
// 			}
// 		}
// 		// fragment.mesh.updateMatrix();
// 	}
