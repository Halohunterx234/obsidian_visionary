import { App, PluginSettingTab, Setting } from 'obsidian';
import Visionary from './main.ts';

export interface PluginSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	mySetting: 'default',
};

export class SettingTab extends PluginSettingTab {
	plugin: Visionary;

	constructor(app: App, plugin: Visionary) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
