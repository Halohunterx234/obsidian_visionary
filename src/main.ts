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
import { DEFAULT_SETTINGS, PluginSettings, SettingTab } from './settings.ts';

import {
	BaseNode,
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
	path: string;
	'character count': number;
	parent: string | undefined;
	name: string;
}

type Frontmatter = {
	categories?: string | string[];
	[key: string]: unknown;
};

export default class Visionary extends Plugin {
	settings!: PluginSettings;
	nodes: BaseNode[] = [];
	categories: Map<string, number> = new Map();

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
		// this.registerDomEvent(activeDocument, 'click', (_evt: MouseEvent) => {
		// 	new Notice('Click');
		// });

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
			(leaf) => new KnowledgeMapView(leaf, this),
			// (leaf) => new KnowledgeMapView(leaf, this),
		);

		this.addCommand({
			id: 'open-knowledge-map',
			name: 'Open knowledge map',
			callback: () => {
				// Open your view
				this.activateView().catch((err: unknown) => {
					if (typeof err === 'string') {
						new Notice('Map View failed to render, Error: ' + err);
					}
				});
			},
		});

		// Dealing with events
		// find the exact node corresponding to the file
		// note: this is called when the vault first loads each file
		this.registerEvent(
			this.app.vault.on('create', async (event: TAbstractFile) => {
				// add to nodes
				const newNode: DataNode = {
					type: 'node',
					categories: [],
					data: {
						id: event.path,
						name: event.name,
						score: 0,
					},
				};
				await this._addNode(newNode).then(() => this.refreshGraph());
			}),
		);

		this.registerEvent(
			this.app.vault.on('modify', async (event) => {
				console.log(event.path);
				await this.loadFileContents(event.path).then(
					async (file_details) => {
						if (file_details === null) return;
						await this.updateNodeDetails(file_details).then(() =>
							this.refreshGraph(),
						);
					},
				);
			}),
		);

		this.registerEvent(
			this.app.vault.on('delete', async (event) => {
				// if a note is deleted, delete all clones
				const path = event.path;
				if (path != undefined) {
					await this._removeNode(path, null).then(() =>
						this.refreshGraph(),
					);
				}
			}),
		);

		this.registerEvent(
			this.app.vault.on('rename', async (event, oldPath) => {
				const new_path = event.path;
				if (new_path != undefined && oldPath != undefined) {
					const old_node = await this.getNode(oldPath);
					if (old_node != null) {
						let new_name = event.name.split(".");
						let name = new_name[0];
						if (new_name.length == 0 || name === undefined) {
							console.error("New name not present");
							return
						}
						const updatedNode: BaseNode = {
							type: old_node.type,
							categories: old_node.categories,
							data: {
								id: new_path,
								name: name,
								color: old_node.data.color,
								outline_color: old_node.data.outline_color,
								score: old_node.data.score, // update this
								parent: old_node.data.parent,
								size: old_node.data.size,
							},
						};
						try {
							await this._editNode(
								old_node.data.id,
								updatedNode,
							).then(() => this.refreshGraph());
						} catch (error) {
							console.error('Failed to update node:', error);
						}
					}
				}
			}),
		);

		// easiest way to add categories
		// markdown code processor
		this.registerMarkdownCodeBlockProcessor(
			'categories',
			(source, el, ctx) => {
				const categories = source
					.split('\n')
					.map((x) => x.trim())
					.filter(Boolean);
				for (const category of categories) {
					const button = el.createEl('button', {
						text: category,
					});
					button.addEventListener('click', () => {
						const file = this.app.vault.getAbstractFileByPath(
							ctx.sourcePath,
						);
						const file_name = file?.name.split('.');

						if (!(file instanceof TFile) || file_name === undefined)
							return;

						if (file_name[0] === undefined) return;

						let file_basename: string = file_name[0];
						let file_path: string = file?.path;

						// edit note's frontmatter data
						this.app.fileManager
							.processFrontMatter(
								file,
								(frontmatter: Frontmatter) => {
									let categories: string[];

									if (Array.isArray(frontmatter.categories)) {
										categories =
											frontmatter.categories.filter(
												(value): value is string =>
													typeof value === 'string',
											);
									} else if (
										typeof frontmatter.categories ===
										'string'
									) {
										categories = [frontmatter.categories];
									} else {
										categories = [];
									}

									// remove if clicked again
									if (categories.includes(category)) {
										categories = categories.filter(
											(x: string) => x !== category,
										);
										// link to plugin's categories
										let number =
											this.categories.get(category);
										if (number != undefined && number > 0)
											this.categories.set(
												category,
												number - 1,
											);
										this.remove_category(
											file_path,
											category,
										);
									} else {
										// add if not added
										categories.push(category);
										// link to plugin's categories
										// if its new, add
										if (!this.categories.get(category))
											this.categories.set(category, 1);
										else {
											let number =
												this.categories.get(category);
											if (number != undefined)
												this.categories.set(
													category,
													number + 1,
												);
										}
										this.add_category(file_path, category);
									}

									frontmatter.categories = categories;
								},
							)
							.catch((error) => {
								console.error(error);
							});
					});
				}
			},
		);
	}

	refreshGraph() {
		this.app.workspace
			.getLeavesOfType(VIEW_TYPE_KNOWLEDGE_MAP)
			.forEach((leaf) => {
				if (leaf.view instanceof KnowledgeMapView) {
					leaf.view
						.refresh_graph()
						.catch((error) => console.error(error));
				}
			});
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
			return createNode(
				fileObj.path,
				fileObj.name,
				undefined,
				undefined,
				fileObj['character count'],
				undefined,
				undefined,
				'node',
				[],
			);
		});
		return null;
	}

	// load singular file's details
	async loadFileContents(file_path: string): Promise<FileContents | null> {
		const file = this.app.vault
			.getMarkdownFiles()
			.find((value) => value.path === file_path);
		let values = null;
		if (file != null) {
			values = {
				path: file.path,
				'character count': await this.app.vault
					.cachedRead(file)
					.then((charCount) => charCount.length),
				parent: file.parent?.path,
				name: file.basename,
			};
		}
		return values ?? null;
	}

	// middle level methods
	// intention to bridge the layer between node data type and higher level types

	// with the exact file, we can craft a updated node and replace the existing one
	async updateNodeDetails(details: FileContents): Promise<void> {
		/// find the current node
		const data_node = await this.getNode(details.path);

		if (data_node === undefined) return;

		const updatedNode: BaseNode = {
			type: data_node.type,
			categories: data_node.categories,
			data: {
				id: data_node.data.id,
				name: data_node.data.name,
				color: data_node.data.color,
				outline_color: data_node.data.outline_color,
				score: details['character count'], // update this
				parent: data_node.data.parent,
				size: data_node.data.size,
			},
		};

		try {
			await this._editNode(data_node.data.id, updatedNode);
		} catch (error) {
			console.error('Failed to update node:', error);
		}

		return;
	}

	// update a node and its categories
	private remove_category(file_path: string, category: string) {
		this.getNode(file_path)
			.then((value) => {
				if (value != undefined) {
					let node = value;
					node.categories.remove(category);
					this._editNode(file_path, node).catch((error) =>
						console.error(error),
					);
					this.refreshGraph();
				}
			})
			.catch((error) => console.error(error));
	}

	private add_category(file_path: string, category: string) {
		this.getNode(file_path)
			.then((value) => {
				if (value != undefined) {
					let node = value;
					node.categories.push(category);
					this._editNode(file_path, node).catch((error) =>
						console.error(error),
					);
					this.refreshGraph();
				}
			})
			.catch((error) => console.error(error));
	}

	// node level methods
	// obsidian doesnt allow notes of same names
	private async _addNode(node: BaseNode): Promise<null> {
		// check if already existing node of the same name
		this.nodes.push(node);
		return null;
	}
	// remove either all references of a node or a specific node
	private async _removeNode(
		name: string,
		category: null | string,
	): Promise<null> {
		// if no declared categories then delete all
		let nodes: BaseNode[] = [];
		if (category === null) {
			nodes = this.nodes.filter((value) => value.data.id != name);
		} else {
			nodes = this.nodes.filter(
				(value) =>
					!value.categories.contains(category) &&
					value.data.id != name,
			);
		}
		this.nodes = nodes;
		// to do
		// maybe add a throwback if the node isnt present?
		return null;
	}
	// to do
	// update after implementing categroies
	// there may be duplicate nodes with same id
	private async _editNode(file_path: string, node: BaseNode): Promise<null> {
		let idx = undefined;
		this.nodes.find((val, node_idx) => {
			if (val.data.id == file_path) {
				idx = node_idx;
			}
		});
		// if found, edit
		if (idx != undefined) this.nodes.splice(idx, 1, node);
		return null;
	}
	private async getNode(name: string): Promise<undefined | BaseNode> {
		return this.nodes.find((val) => val.data.id === name);
	}

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

		if (leaf != undefined)
			workspace.revealLeaf(leaf).catch((error) => console.error(error));
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

// constructor, for creating or transferring node data
export function createNode(
	id: string,
	name: string,
	color: string | undefined = config.default_node_color,
	outline_color: string | undefined = config.default_node_outline_color,
	score: number = 0,
	parent: string | undefined = undefined,
	size: number | undefined = config.default_node_size,
	type: NodeType,
	categories: string[],
): BaseNode {
	return {
		type: type,
		categories: categories,
		data: {
			id: id,
			name: name,
			color: color,
			outline_color: outline_color,
			score: score,
			parent: parent,
			size: size,
		},
	};
}
