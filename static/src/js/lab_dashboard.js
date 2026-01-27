/** @odoo-module */
import { registry } from '@web/core/registry';
import { useService } from "@web/core/utils/hooks";
import { Component, onMounted, useState, useRef } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";

export class LabDashBoard extends Component {
    setup() {
        this.orm = useService('orm');
        this.actionService = useService("action");
        this.ref = useRef("root");

        this.state = useState({
            tests_confirm: [],
            tests_confirm_data: {},
            test_data: [],
            all_test_data: [],
            published_data: [],
            summary: {
                tests_to_confirm: 0,
                process_test: 0,
                published: 0,
            },
        });

        this.record_id = false;

        onMounted(async () => {
            // default load for first tab + summary counts
            await Promise.all([
                this._loadTestData(),
                this._loadSummaryCounts(),
            ]);
        });
    }

    // Top cards: aggregated counts
    async _loadSummaryCounts() {
        const [toConfirm, processTests, published] = await Promise.all([
            this.orm.call('lab.test.line', 'search_count', [[['state', '=', 'draft']]]),
            this.orm.call('patient.lab.test', 'search_count', [[]]),
            this.orm.call('lab.test.result', 'search_count', [[]]),
        ]);

        this.state.summary.tests_to_confirm = toConfirm || 0;
        this.state.summary.process_test = processTests || 0;
        this.state.summary.published = published || 0;
    }

    // TAB-1: draft test lines
    async _loadTestData() {
        this.state.tests_confirm_data = {};
        this.state.test_data = [];
        const domain = [['state', '=', 'draft']];
        const result = await this.orm.call('lab.test.line', 'search_read', [domain], {
            fields: ['display_name', 'patient_id', 'doctor_id', 'patient_type', 'date'],
            order: 'id desc',
        });
        this.state.tests_confirm = result || [];
        this.state.summary.tests_to_confirm = this.state.tests_confirm.length;
    }

    // click row: load detail for draft test line
    async _fetchTestData(ev) {
        const index = parseInt(ev.currentTarget.dataset.index, 10);
        const line = this.state.tests_confirm[index];
        if (!line) return;

        this.record_id = line.id;

        const result = await this.orm.call('lab.test.line', 'action_get_patient_data', [this.record_id]);
        this.state.tests_confirm_data = result || {};
        this.state.test_data = (result && result.test_data) ? result.test_data : [];
    }

    // confirm button
    async confirmLabTest() {
        if (!this.record_id) return;

        await this.orm.call('lab.test.line', 'create_lab_tests', [this.record_id]);
        // Optional: refresh list + clear details
        await this._loadTestData();
        this.state.tests_confirm_data = {};
        this.state.test_data = [];
        this.record_id = false;

        await this._loadSummaryCounts();

        this._notify(_t("Success"), _t("The test has been confirmed."));
    }

    // TAB-2: all patient.lab.test
    async _allLabTest() {
        const result = await this.orm.call('patient.lab.test', 'search_read', [[]], {
            fields: ['display_name', 'patient_id', 'date', 'total_price', 'state'],
            order: 'id desc',
        });
        this.state.all_test_data = result || [];
        this.state.summary.process_test = this.state.all_test_data.length;
        await this._loadSummaryCounts();
    }

    // open form view using real id (we set data-index = testdata.id in XML)
    async fetch_all_test_data(ev) {
        const recordId = parseInt(ev.currentTarget.dataset.index, 10);
        if (!recordId) return;

        return this.actionService.doAction({
            name: _t('Inpatient details'),
            type: 'ir.actions.act_window',
            res_model: 'patient.lab.test',
            res_id: recordId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    // TAB-3: published
    async _loadPublished() {
        const result = await this.orm.call('lab.test.result', 'print_test_results', []);
        this.state.published_data = result || [];
        this.state.summary.published = this.state.published_data.length;
        await this._loadSummaryCounts();
    }

    // Small helper (optional). If you want notifications, inject notification service.
    _notify(title, message) {
        // fallback alert if you don't add notification service
        alert(`${title}\n${message}`);
    }

    // Optional placeholder handlers for top-right buttons (export/print)
    _exportConfirm() { this._notify(_t("Info"), _t("Export not implemented yet.")); }
    _printConfirm()  { this._notify(_t("Info"), _t("Print not implemented yet.")); }
    _exportProcess() { this._notify(_t("Info"), _t("Export not implemented yet.")); }
    _printProcess()  { this._notify(_t("Info"), _t("Print not implemented yet.")); }
    _exportPublished(){ this._notify(_t("Info"), _t("Export not implemented yet.")); }
    _printPublished() { this._notify(_t("Info"), _t("Print not implemented yet.")); }
}

LabDashBoard.template = "LabDashboard";
registry.category("actions").add('lab_dashboard_tags', LabDashBoard);
