import {Controller, History} from "cx/ui";
import {updateArray} from "cx/data";
import {MsgBox} from "cx/widgets";
import {runHealthCheckOnReport} from "api";

import {
	loadReport,
	addReport,
	saveReport,
	deleteReport,
	currentUserId,
	addStar,
	removeStar,
	isStarred
} from "api";

import uid from "uid";

export default class extends Controller {
	onInit() {
		this.loadReport();

		this.addComputable(
			"$page.editable",
			["user", "$page.report", "$route.id"],
			(user, report, id) =>
			id == "new" || (user && report && report.userId == user.uid)
		);
	}

	loadReport() {
		let id = this.store.get("$route.id");
		if (id != "new") {
			if (!this.store.get("$page.report"))
				this.store.set("$page.status", "loading");

			loadReport(id).then(def => {
				if (!def) {
					runHealthCheckOnReport(id);
				}
				this.store.set("$page.report", def || {dummy: true});
				this.store.delete("$page.status");
				this.setupAutoSave();
			});

			//if report is opened directly, user object might not be available immediately
			this.addTrigger(
				"star",
				["user"],
				() => {
					if (currentUserId()) {
						isStarred(id).then(value =>
							this.store.set("$page.starred", value)
						);
					}
				},
				true
			);
		} else {
			let copy = this.store.get("clipboard.report");

			this.store.set("$page.report", {
				title: "New Report",
				sections: [],
				public: false,
				...copy,
				userId: currentUserId(),
				id: null
			});

			this.store.delete("clipboard.report");

			this.addMap();
		}

		this.addTrigger("trackPins", ["$page.report"], report => {
			let defaults = report.defaults || {};
			if (report.sections)
				this.store.update("$page.report.sections", updateArray, section => {
					let pins = {
						...section.pins
					};
					pins.fromYear = pins.toYear = pins.period;
					[
						"topic",
						"region",
						"countries",
						"fromYear",
						"toYear"
					].forEach(field => {
						if (pins[field] && section[field] != defaults[field])
							section = {
								...section,
								[field]: defaults[field] || null //firebase rejects undefined values
							};
					});
					return section;
				});
		});
	}

	toggleLock() {
		this.store.toggle("$page.report.public");
	}

	editHeader() {
		let {title, description, defaults} = this.store.get("$page.report");
		this.store.set("$page.header", {
			title,
			description,
			edit: true
		});
		this.store.set("$page.defaults", defaults);
	}

	setupAutoSave() {
		this.addTrigger("autoSave", ["$page.report"], report => {
			if (currentUserId() == report.userId) this.saveReport();
		});
	}

	saveReport() {
		let report = this.store.get("$page.report");
		let id = this.store.get("$route.id");

		if (id == "new") {
			addReport(report).then(rep => {
				History.replaceState({}, null, `~/${rep.id}`);
			});
		} else {
			saveReport(id, report);
		}
	}

	deleteReport() {
		let id = this.store.get("$route.id");
		if (id != "new") {
			deleteReport(id).then(() => {
				History.replaceState({}, null, `~/`);
			});
		}
	}

	copyReport() {
		let rep = this.store.get("$page.report");
		this.store.set("clipboard.report", rep);
		History.pushState({}, null, `~/new`);
	}

	starReport() {
		let id = this.store.get("$route.id");
		addStar(id).then(() => {
			this.store.set("$page.starred", true);
		});
	}

	unstarReport() {
		let id = this.store.get("$route.id");
		removeStar(id).then(() => {
			this.store.set("$page.starred", false);
		});
	}

	addMap(e) {
		let defaults = this.store.get("$page.report.defaults") || {};

		this.addSection(e, {
			type: "map",
			topic: defaults.topic,
			year: defaults.toYear,
			region: defaults.region,
			title: '{indicator} {region:prefix; in } - {year}'
		});
	}

	addLegend(e) {
		let defaults = this.store.get("$page.report.defaults") || {};

		this.addSection(e, {
			type: "legend",
			region: defaults.region,
			countries: defaults.countries,
			title: 'Legend'
		});
	}

	addLineGraph(e) {
		let defaults = this.store.get("$page.report.defaults") || {};

		this.addSection(e, {
			type: "line-chart",
			topic: defaults.topic,
			indicator: defaults.indicator,
			fromYear: defaults.fromYear,
			toYear: defaults.toYear,
			region: defaults.region,
			countries: defaults.countries,
			title: "{indicator}"
		});
	}

	addLineComparison(e) {
		let defaults = this.store.get("$page.report.defaults") || {};

		this.addSection(e, {
			type: "line-comparison",
			topic: defaults.topic,
			fromYear: defaults.fromYear,
			toYear: defaults.toYear,
			region: defaults.region,
			title: "{topic} in {country}"
		});
	}

	addColumnGraph(e) {
		let defaults = this.store.get("$page.report.defaults") || {};

		this.addSection(e, {
			type: "column-chart",
			topic: defaults.topic,
			year: defaults.toYear,
			region: defaults.region,
			countries: defaults.countries,
			title: '{topic} in {countries} - {year}'
		});
	}

	addBarGraph(e) {
		let defaults = this.store.get("$page.report.defaults") || {};

		this.addSection(e, {
			type: "bar-chart",
			topic: defaults.topic,
			region: defaults.region,
			indicator: defaults.indicator,
			title: 'Top {top} - {indicator} {region:prefix; in } - {year}'
		});
	}

	addTableTrend(e) {
		let defaults = this.store.get("$page.report.defaults") || {};

		this.addSection(e, {
			type: "table-trend",
			topic: defaults.topic,
			region: defaults.region,
			indicator: defaults.indicator,
			fromYear: defaults.fromYear,
			toYear: defaults.toYear,
			title: '{indicator} {region:prefix; in }'
		});
	}

	addTableIndicators(e) {
		let defaults = this.store.get("$page.report.defaults") || {};

		this.addSection(e, {
			type: "table-comparison",
			region: defaults.region,
			year: defaults.toYear,
			title: '{topic} {region:prefix; in } - {year}'
		});
	}

	addSection(e, section) {
		if (e)
			e.preventDefault();

		document.activeElement.blur();

		let data = {
			title: "New Section",
			id: uid()
		};

		for (var key in section)
			if (typeof section[key] != "undefined") data[key] = section[key];

		this.store.update("$page.report.sections", sections => [
			...(sections || []),
			data
		]);

		//open in edit mode
		this.store.update("$page.sections", sections => ({
			...sections,
			[data.id]: {form: data, isNew: true}
		}));
	}

	duplicateSection(e, {store}) {
		e.preventDefault();
		document.activeElement.blur(); //close menu

		let section = store.get('$section');
		let index = store.get('$index');

		this.store.update("$page.report.sections", sections => [
			...sections.slice(0, index + 1),
			{
				...section,
				id: uid()
			},
			...sections.slice(index + 1)
		]);
	}

	deleteSection(e, {store}) {
		e.preventDefault();
		document.activeElement.blur(); //close menu

		let section = store.get('$section');
		MsgBox.yesNo("Are you sure that you want to delete this section?")
			.then(btn => {
				if (btn === 'yes') {
					this.store.update("$page.report.sections", sections => sections.filter(s => s !== section));
				}
			});
	}
}
