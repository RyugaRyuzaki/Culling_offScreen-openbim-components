import React, { useEffect, useRef } from "react";
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
	const matrix = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
	const matrixInverse = matrix.clone().transpose();
	scene.matrix.premultiply(matrix).multiply(matrixInverse);
	// highlight
	const fragments = new OBC.FragmentManager(components);
	const highlighter = new OBC.FragmentHighlighter(components);
	(components.renderer as OBC.PostproductionRenderer).postproduction.customEffects.outlineEnabled = true;
	highlighter.outlineEnabled = true;
	// color

	const colorChange = new THREE.Color().setRGB(235 / 255, 64 / 255, 52 / 255, "srgb");
	const materialChange = new THREE.MeshLambertMaterial({ color: colorChange });

	const highlightMaterial = new THREE.MeshBasicMaterial({
		color: "#BCF124",
		depthTest: false,
		opacity: 0.8,
		transparent: true,
	});

	highlighter.add("default", [highlightMaterial]);
	highlighter.outlineMaterial.color.set(0xf0ff7a);
	const singleSelection = {
		value: true,
	};

	let lastSelection: OBC.FragmentIdMap | null;
	const highlightOnClick = async () => {
		const result = await highlighter.highlight("default", singleSelection.value);
		lastSelection = null;
		if (result) {
			lastSelection = {};
			for (const fragment of result.fragments) {
				const fragmentID = fragment.id;
				lastSelection[fragmentID] = new Set([result.id]);
			}
		}
	};

	container.addEventListener("click", highlightOnClick);
	const ifcWorker = new IfcWorker(components);
	new Culling(components);
	const toolbar = new OBC.Toolbar(components);
	// load model btn
	const loadButton = new OBC.Button(components);
	loadButton.materialIcon = "download";
	loadButton.tooltip = "Load model";
	loadButton.onClick.add(ifcWorker.loadModel);
	// change color element
	const changeColor = new OBC.Button(components);
	changeColor.materialIcon = "account_tree";
	changeColor.tooltip = "List Buckets";
	changeColor.onClick.add(() => {
		changeColorElement();
	});
	components.ui.addToolbar(toolbar);

	toolbar.addChild(loadButton);
	toolbar.addChild(changeColor);
	function changeColorElement() {
		if (!lastSelection) return;
		for (const fragmentID in lastSelection) {
			const ids = lastSelection[fragmentID] as Set<string>;
			changeColorItemElement(ids, fragmentID);
		}
	}
	function changeColorItemElement(ids: Set<string>, fragmentID: string) {
		const fragment = fragments.list[fragmentID];
		if (!fragment) return;
		const isBlockFragment = fragment.blocks.count > 1;
		fragment.mesh.updateMatrixWorld(true);

		if (isBlockFragment) {
			const newGeometry = new THREE.BufferGeometry();
			newGeometry.attributes = fragment.mesh.geometry.attributes;
			newGeometry.index = fragment.mesh.geometry.index;
			const indices = fragment.mesh.geometry.index.array;
			// create anew InstancedMesh
			const newMesh = new THREE.InstancedMesh(newGeometry, materialChange, fragment.capacity);
			newMesh.frustumCulled = false;
			newMesh.renderOrder = 999;
			fragment.mesh.updateMatrixWorld(true);
			newMesh.applyMatrix4(fragment.mesh.matrixWorld);

			scene.add(newMesh);
			// get indices that does not exited in ids
			const newIndex: number[] = [];
			const originIndex: number[] = [];
			for (let i = 0; i < indices.length - 2; i += 3) {
				const index = indices[i];
				const blockID = fragment.mesh.geometry.attributes.blockID.array;
				const block = blockID[index];
				const itemID = fragment.mesh.fragment.getItemID(0, block);
				if (!ids.has(itemID)) {
					originIndex.push(indices[i], indices[i + 1], indices[i + 2]);
				} else {
					newIndex.push(indices[i], indices[i + 1], indices[i + 2]);
				}
			}
			newMesh.geometry.setIndex(newIndex);
			fragment.mesh.geometry.setIndex(originIndex);
			newMesh.instanceMatrix.needsUpdate = true;
			fragment.mesh.instanceMatrix.needsUpdate = true;
			// remove indices of existing merge fragment mesh
		} else {
			for (const id of ids) {
				const { instanceID } = fragment.getInstanceAndBlockID(id);

				fragment.mesh.setColorAt(instanceID, colorChange);
				console.log(colorChange);
			}
			fragment.mesh.instanceColor!.needsUpdate = true;
		}
		fragment.mesh.updateMatrix();
	}

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
