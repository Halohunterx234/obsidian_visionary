import { ItemView, Plugin, setTooltip, WorkspaceLeaf } from 'obsidian';

import Visionary, { VIEW_TYPE_KNOWLEDGE_MAP, createNode } from './main.ts';

import { DEFAULT_SETTINGS, PluginSettings, SettingTab } from './settings.ts';

import {
	BaseNode,
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

	// element states
	private tooltip: HTMLDivElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: Visionary) {
		super(leaf);
		this.plugin = plugin;
	}

	private nodes_to_ele(nodes: BaseNode[]): ElementDefinition[] {
		return nodes.map((node) => ({
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
		// refresh
		const refresh_button = container.createEl('button', {
			text: 'Refresh',
		});
		refresh_button.addEventListener('click', () => {
			this.refresh_graph().catch((error) => console.error(error));
		});
		this.graphEl = container.createDiv({
			cls: 'knowledge-map-container',
		});

		this.tooltip = document.createElement('div');
		document.body.appendChild(this.tooltip);

		const el = this.graphEl;
		if (el == null) return;

		el.setCssProps({
			width: '100%',
			height: '500px',
			// "background-color": "blue",
		});

		let nodes_ele = this.nodes_to_ele(this.plugin.nodes);

		this.cy = cytoscape({
			container: el, //: document.getElementById('cy'), // container to render in

			elements: nodes_ele,

			style: [
				// the stylesheet for the graph
				{
					selector: 'node',
					style: {
						'background-color': 'data(color)',
						label: 'data(name)',
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

		// add any functionality to the graph view nodes

		// tooltip
		this.tooltip.style.position = 'fixed';
		this.tooltip.style.display = 'none';
		this.tooltip.style.backgroundColor = '#4e4646';

		this.cy.on('mouseover', 'node', (event) => {
			if (this.tooltip === null) Error('Tooltip is missing.');
			else {
				const node = event.target;

				this.tooltip.style.display = 'block';
				this.tooltip.textContent = node.data('id');

				const position = node.renderedPosition();
				const rect = el.getBoundingClientRect();

				this.tooltip.style.left = `${rect.left + position.x + 10}px`;
				this.tooltip.style.top = `${rect.top + position.y + 10}px`;
			}
		});

		this.cy.on('mouseout', 'node', () => {
			if (this.tooltip != null) this.tooltip.style.display = 'none';
		});
	}

	async refresh_graph() {
		this.cy?.elements().remove();
		this.cy?.layout(this.options).run();

		// reset elements

		// load the categories
		// if empty, later will discard
		let categories: BaseNode[] = [];
		this.plugin.categories.forEach((num, cat) => {
			if (num == 0) {
				return;
			}
			let category_node = createNode(
				'category' + '-' + cat,
				cat,
				config.default_category_color,
				config.default_category_outline_color,
				undefined,
				undefined,
				undefined,
				'category',
				[],
			);
			categories.push(category_node);
		});
		// console.log('categories', this.nodes_to_ele(categories));
		// console.log("plugin nodes", this.plugin.nodes);
		if (categories.length > 0) this.cy?.add(this.nodes_to_ele(categories));

		// grab all the nodes
		// and time to build the rest of the stuff
		let nodes: BaseNode[] = [];
		this.plugin.nodes.forEach((node) => {
			// if have categories
			// split it for each
			if (node.categories.length > 0) {
				node.categories.forEach((category) => {
					let category_node = createNode(
						node.data.id + '-' + category,
						node.data.name,
						undefined,
						undefined,
						node.data.score,
						'category' + '-' + category,
						node.data.size,
						'node',
						[category],
					);
					nodes.push(category_node);
				});
			} else {
				nodes.push(node);
			}
		});

		console.log('nodes before being pushed to view', nodes);

		this.cy?.add(this.nodes_to_ele(nodes));

		// editing data
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

		console.log("cy's nodes", this.cy?.nodes());
	}

	async onClose() {
		this.cy?.destroy();
		this.tooltip?.remove();
	}
}
