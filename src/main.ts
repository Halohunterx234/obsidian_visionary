import {
	Editor,
	MarkdownView,
	MarkdownFileInfo,
	Modal,
	Notice,
	Plugin,
	ItemView,
	WorkspaceLeaf,
	TFile,
	TAbstractFile,
} from 'obsidian';
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
	NodeType,
} from './nodes.ts';


import { config } from './config.ts';

import KnowledgeMapView from './mapview.ts';

// graph
import cytoscape, { ElementDefinition } from 'cytoscape';

export const VIEW_TYPE_KNOWLEDGE_MAP = 'knowledge-map';

interface FileContents {
	path: string,
	'character count': number,
	parent: string | undefined,
	name: string;
}
export default class Visionary extends Plugin {
	settings!: PluginSettings;
	nodes: Node[] = [];
	map_view: KnowledgeMapView | undefined = undefined;

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
				new Modal(this.app).open();
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
						new Modal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
				return false;
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(activeDocument, 'click', (_evt: MouseEvent) => {
			new Notice('Click');
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(
		// 	window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000),
		// );

		// HEREEE
		// inital load of the notes
		// TO DO: load from data.json instead
		await this.loadFiles();

		// graph view
		this.registerView(
			VIEW_TYPE_KNOWLEDGE_MAP,
			(leaf) => {
				this.map_view = new KnowledgeMapView(leaf, this);
				return this.map_view
			}
			// (leaf) => new KnowledgeMapView(leaf, this),
		);

		this.addCommand({
			id: 'open-knowledge-map',
			name: 'Open knowledge map',
			callback: () => {
				// Open your view
				this.activateView();
			},
		});

		// Dealing with events
		// find the exact node corresponding to the file
		// note: this is called when the vault first loads each file
		this.registerEvent(this.app.vault.on('create', async (event: TAbstractFile) => {
			// add to nodes
			const newNode: DataNode = {
				type: "node",
				categories: [],
				data: {
					id: event.name,
					score: 0,
				}
			}
			await this._addNode(newNode);
			this.map_view?.refresh_graph();
		}))
		
		this.registerEvent(this.app.vault.on('modify', async (event) => {
			let file_details = await this.loadFileContents(event.name);
			if (file_details === null) return;
			console.log(file_details);
			await this.updateNodeDetails(file_details);
			// refresh
			this.map_view?.refresh_graph();
		}))

		this.registerEvent(this.app.vault.on('delete', async (event) => {
			// if a note is deleted, delete all clones
			const name = event.name.split('.')[0];
			if (name != undefined) {
				await this._removeNode(name, null);
				this.map_view?.refresh_graph();
			}
		}))

		this.registerEvent(this.app.vault.on('rename', async (event, oldPath) => {
			const name = event.name.split('.')[0];
			if (name != undefined) {
				// const node = this.createNode(name, )
				const oldFileName = oldPath.substring(oldPath.lastIndexOf("/")+1).split(".")[0];
				if (oldFileName != undefined) {
					let node = this.getNode(oldFileName);
					// to do
					// settle after implementing categories
				}
			}
		}))

		// easiest way to add categories
		// markdown code processor
		this.registerMarkdownCodeBlockProcessor("categories", (source, el, ctx) => {
			const categories = source
				.split("\n")
				.map(x => x.trim())
				.filter(Boolean);
			for (const category of categories) {
				const button = el.createEl("button", {
					text: category,
				});
				button.addEventListener("click", async () => {
					const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);

					if (!(file instanceof TFile)) return;
					await this.app.fileManager.processFrontMatter(
						file, (frontmatter) => {
					let categories = frontmatter.categories ?? [];

					if (!Array.isArray(categories)) {
						categories = [categories];
					}

					if (categories.includes(category)) {
						categories = categories.filter((x: string) => x !== category);
					} else {
						categories.push(category);
					}

					frontmatter.categories = categories;
				});
				})
			}
			
		})
	}

	// loads a huge amt of data
	// to-do, load from cached data.json instead unless via special command for first time
	async loadFiles(): Promise<null> {
		const { vault } = this.app;
		const fileContents = await Promise.all(
			vault.getMarkdownFiles().map(async (file) => {
				return {
					path: file.path,
					'character count': (await vault.cachedRead(file)).length,
					parent: file.parent?.path,
					name: file.basename,
				};
			}),
		);
		this.nodes = fileContents.map((fileObj) => {
				return this.createNode(
					fileObj.name, undefined, undefined,
					fileObj['character count'], undefined,
					undefined, 'node', []
				);
			});
		console.log('nodes loaded');

		// fileContents.forEach((content) => {
		// 	console.log('Path:', content.path);
		// 	console.log('Character count:', content['character count']);
		// 	console.log('Parent:', content.parent);
		// 	console.log('Name:', content.name);
		// });
		return null;
	}

	// load singular file's details
	async loadFileContents(file_name: string): Promise<FileContents | null>{
		const file = this.app.vault.getMarkdownFiles().find(
			(value) => value.name === file_name
		);
		let values = null;
		if (file != null) {
			values = {
				path: file.path,
				'character count': (await this.app.vault.cachedRead(file)).length,
				parent: file.parent?.path,
				name: file.basename,
			}
		}
		return values ?? null;
	}

	// middle level methods
	// intention to bridge the layer between node data type and higher level types

	// with the exact file, we can craft a updated node and replace the existing one
	async updateNodeDetails(details: FileContents): Promise<null> {
		/// find the current node
		console.log("before: ", this.nodes)
		let data_node: Node | undefined = await this.getNode(details.name);
		if (data_node === undefined) return null;
		let updated_node: Node = {
			type: data_node.type,
			categories: data_node.categories,
			data: {
				id: data_node.data.id,
				score: details['character count'],// update this
			}	
		}
		await this._editNode(updated_node);
		console.log("after: ", this.nodes)
		return null;
	}


	// node level methods
	// obsidian doesnt allow notes of same names
	private async _addNode(node: Node): Promise<null> {
		// check if already existing node of the same name
		this.nodes.push(node);
		return null;
	}
	// remove either all references of a node or a specific node
	private async _removeNode(name: string, category: null | string): Promise<null> {
		// if no declared categories then delete all
		let nodes: Node[] = [];
		if (category === null) {
			nodes = this.nodes.filter((value) => 
				value.data.id != name
			);
		} else {
			nodes = this.nodes.filter((value) => 
				!value.categories.contains(category) && 
			value.data.id != name )
		}
		this.nodes = nodes;
		// to do
		// maybe add a throwback if the node isnt present?
		return null;
	}
	// to do
	// update after implementing categroies
	// there may be duplicate nodes with same id
	private async _editNode(node: Node): Promise<null> {
		const id = node.data.id;
		let idx = undefined;
		this.nodes.find((val, node_idx) => {
			if (val.data.id == id) {
				idx = node_idx;
			}
		})
		// if found, edit
		if (idx != undefined) this.nodes.splice(idx, 1, node)
		return null;
	}
	private async getNode(name: string): Promise<undefined | Node> {
		return this.nodes.find((val) => (val.data.id === name))
	}

	// constructor, for creating or transferring node data
	private createNode(id: string,
		color: string|undefined=config.default_node_color, 
		outline_color: string|undefined=config.default_node_outline_color,
		score: number=0, parent: string|undefined=undefined,
		size: number|undefined=config.default_node_size, type: NodeType, categories: string[]): Node {
			return {
				type: type,
				categories: categories,
				data: {
					id: id,
					color: color,
					outline_color: outline_color,
					score: score,
					parent: parent,
					size: size, 
				}
			}
		}
	
	

	// newNode(obj): Node {
		// to do, constructor that fills all non-defined
		// arguments with default values
	// }

	// turn on the view - obsidian docs
	async activateView() {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_KNOWLEDGE_MAP);
		let leaf: WorkspaceLeaf | null | undefined = null;
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) return;
			await leaf?.setViewState({
				type: VIEW_TYPE_KNOWLEDGE_MAP,
				active: true,
			});
		}

		if (leaf != undefined) workspace.revealLeaf(leaf);
	}

	// vv important, remb to do
	onunload() {
		// to save all data necessary
		// and free everything else
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<PluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class Modal extends Modal {
	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}




