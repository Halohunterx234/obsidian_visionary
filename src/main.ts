import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Modal,
	Notice,
	Plugin,
	ItemView,
	WorkspaceLeaf
} from 'obsidian';
import {
	DEFAULT_SETTINGS,
	MyPluginSettings,
	SampleSettingTab,
} from './settings';

import {  } from "./nodes";
import { nodes } from "./data";
// graph 
import cytoscape from "cytoscape";



// Remember to rename these classes and interfaces!

export default class Visionary extends Plugin {
	settings!: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('dice', 'Sample', (_evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a visionary notice!');
		});

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status bar text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-modal-simple',
			name: 'Open modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			},
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'replace-selected',
			name: 'Replace selected content',
			editorCallback: (
				editor: Editor,
				_ctx: MarkdownView | MarkdownFileInfo,
			) => {
				editor.replaceSelection('Sample editor command');
			},
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-modal-complex',
			name: 'Open modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(activeDocument, 'click', (_evt: MouseEvent) => {
			new Notice('Click');
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000),
		);

		// HEREEE

		 this.registerView(
            VIEW_TYPE_KNOWLEDGE_MAP,
            (leaf) => new KnowledgeMapView(leaf)
        );

        this.addCommand({
            id: "open-knowledge-map",
            name: "Open knowledge map",
            callback: () => {
                // Open your view
				this.activateView();
            }
        });
	}

		async activateView() {
			const { workspace } = this.app;
			const leaves = workspace.getLeavesOfType(VIEW_TYPE_KNOWLEDGE_MAP);
			let leaf: WorkspaceLeaf | null | undefined = null; 
			if (leaves.length > 0) {
				leaf = leaves[0];
			} else {
				leaf = workspace.getRightLeaf(false);
				if (!leaf) return;
				await leaf?.setViewState({type: VIEW_TYPE_KNOWLEDGE_MAP, active: true});
			}

			if (leaf != undefined) workspace.revealLeaf(leaf);
		}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MyPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export const VIEW_TYPE_KNOWLEDGE_MAP = "knowledge-map";

export class KnowledgeMapView extends ItemView {

	private cy?: cytoscape.Core;
	private graphEl: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}
	
	
	private options = {
		name: 'preset',
		// fit: true,
	}

    getViewType() {
        return VIEW_TYPE_KNOWLEDGE_MAP;
    }

    getDisplayText() {
        return "Knowledge Map";
    }

    async onOpen() {

		const container = this.contentEl;
		container.empty();
		container.createEl('h4', { text: 'Example view' });
        this.graphEl = container.createDiv({
            cls: "knowledge-map-container"
        });

        const el = this.graphEl;
		el.setCssProps({
			width: "100%",
			height: "500px",
			// "background-color": "blue",
		});

		this.cy = cytoscape({

		container: el,//: document.getElementById('cy'), // container to render in

		elements: [ // list of graph elements to start with
			// { // node a
			// data: { id: 'a'}
			// },
			// { // node b
			// data: { id: 'b', degree: 1 }
			// },
			// { // edge ab
			// data: { id: 'ab', source: 'a', target: 'b', degree: 1 }
			// },

			...nodes
		],

		style: [ // the stylesheet for the graph
			{
			selector: 'node',
			style: {
				'background-color': 'data(color)',
				'label': 'data(id)',
				'color': 'data(outline_color)', //'#ffffff',
				'outline-color': "data(outline_color)",
				"outline-width": 1,
				"outline-style": "solid",
				"width": 'data(size)',
				"height": 'data(size)',
			}
			},
			{
				selector: 'node:parent',
				style: {
					'outline-width': 0,
					'border-width': 0
				}
			},
			{
			selector: 'edge',
			style: {
				'width': 3,
				'line-color': '#ebff38',
				'target-arrow-color': '#fa0202',
				'target-arrow-shape': 'triangle',
				'curve-style': 'bezier'
			}
			}
		],

		layout:  this.options,

		});

		// grab all the nodes
		// and time to build the rest of the stuff!
		this.cy?.nodes().forEach(node => {
			const parent = node.parent();

			if (parent.length > 0) {
				// color settings
				node.data("color", parent.data("color"));
				node.data("outline_color", parent.data("outline_color"));
			}
		});
    }

    async onClose() {
        this.cy?.destroy();
    }
}

