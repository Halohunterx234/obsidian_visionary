import {
    ItemView,
    Plugin,
    WorkspaceLeaf,
} from 'obsidian'

import Visionary, {
    VIEW_TYPE_KNOWLEDGE_MAP
 } from './main.ts'

import {
	DEFAULT_SETTINGS,
	PluginSettings,
	SettingTab,
} from './settings.ts';

import {
	Node,
	BaseNodeData,
	DataNode,
	CategoryNode,
	PlaceholderNode,
} from './nodes.ts';

import { config } from './config.ts';

import cytoscape, { ElementDefinition } from 'cytoscape';

export default class KnowledgeMapView extends ItemView {
	private cy?: cytoscape.Core;
	private graphEl: HTMLElement | null = null;
	private plugin: Visionary;

	constructor(leaf: WorkspaceLeaf, plugin: Visionary) {
		super(leaf);
		this.plugin = plugin;
	}

	private nodes_to_ele(): ElementDefinition[] {
		return this.plugin.nodes.map((node) => ({
			group: 'nodes',
			data: node.data,
		})) as ElementDefinition[];
	}

	private options = {
		name: 'preset',
		fit: true,
	};

	getViewType() {
		return VIEW_TYPE_KNOWLEDGE_MAP;
	}

	getDisplayText() {
		return 'Knowledge Map';
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.createEl('h4', { text: 'Graph View' });
		const refresh_button = container.createEl('button', {
			text: 'Refresh',
		});
		refresh_button.addEventListener('click', async () => {
			await this.refresh_graph();
		})
		this.graphEl = container.createDiv({
			cls: 'knowledge-map-container',
		});

		const el = this.graphEl;
		if (el == null) return;

		el.setCssProps({
			width: '100%',
			height: '500px',
			// "background-color": "blue",
		});

		let nodes_ele = this.nodes_to_ele();

		this.cy = cytoscape({
			container: el, //: document.getElementById('cy'), // container to render in

			// elements: this.nodes.map(node => ({ data: node.data })),
			elements: nodes_ele,

			style: [
				// the stylesheet for the graph
				{
					selector: 'node',
					style: {
						'background-color': 'data(color)',
						label: 'data(id)',
						color: 'data(outline_color)', //'#ffffff',
						'outline-color': 'data(outline_color)',
						'outline-width': 1,
						'outline-style': 'solid',
						width: 'data(size)',
						height: 'data(size)',
					},
				},
				{
					selector: 'node:parent',
					style: {
						'outline-width': 0,
						'border-width': 0,
					},
				},
				{
					selector: 'edge',
					style: {
						width: 3,
						'line-color': '#ebff38',
						'target-arrow-color': '#fa0202',
						'target-arrow-shape': 'triangle',
						'curve-style': 'bezier',
					},
				},
			],

			layout: this.options,
		});
		await this.refresh_graph();
	}

	async refresh_graph() {
		await this.plugin.loadFiles();
		this.cy?.elements().remove();
		this.cy?.add(this.nodes_to_ele());
		this.cy?.layout(this.options).run();
		
		// grab all the nodes
		// and time to build the rest of the stuff!
		this.cy?.nodes().forEach((node) => {
			const parent = node.parent();

			// if have parents
			// and isnt a subcategory itself
			if (parent.length > 0 && node.data('type') != 'category') {
				// color settings
				node.data('color', parent.data('color'));
				node.data('outline_color', parent.data('outline_color'));
			}

			//convert score to size
			if (node.data('score') != 0) node.data('size', node.data('score'));
		});
	}

	async onClose() {
		this.cy?.destroy();
	}
}