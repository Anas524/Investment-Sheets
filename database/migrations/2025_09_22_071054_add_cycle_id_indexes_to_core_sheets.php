<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    private function hasIndexOnColumn(string $table, string $column): bool
    {
        $db = DB::getDatabaseName();
        $rows = DB::select(
            'SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            [$db, $table, $column]
        );
        return !empty($rows);
    }

    private function addCycleIndexIfMissing(string $table, string $indexName): void
    {
        if (!Schema::hasTable($table) || !Schema::hasColumn($table, 'cycle_id')) return;

        // If any index on cycle_id exists, skip (name may differ).
        if ($this->hasIndexOnColumn($table, 'cycle_id')) return;

        Schema::table($table, function (Blueprint $t) use ($indexName) {
            $t->index('cycle_id', $indexName);
        });
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (!Schema::hasTable($table)) return;

        $db = DB::getDatabaseName();
        $rows = DB::select(
            'SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            [$db, $table, $indexName]
        );
        if (!empty($rows)) {
            Schema::table($table, fn(Blueprint $t) => $t->dropIndex($indexName));
        }
    }

    public function up(): void
    {
        $this->addCycleIndexIfMissing('gts_materials',  'gts_materials_cycle_id_idx');
        $this->addCycleIndexIfMissing('gts_investments', 'gts_investments_cycle_id_idx');
        $this->addCycleIndexIfMissing('locals',         'locals_cycle_id_idx');
        $this->addCycleIndexIfMissing('us_clients',     'us_clients_cycle_id_idx');
        $this->addCycleIndexIfMissing('s_q_clients',    's_q_clients_cycle_id_idx');
    }

    public function down(): void
    {
        // Only drop if exactly these names exist
        $this->dropIndexIfExists('gts_materials',  'gts_materials_cycle_id_idx');
        $this->dropIndexIfExists('gts_investments', 'gts_investments_cycle_id_idx');
        $this->dropIndexIfExists('locals',         'locals_cycle_id_idx');
        $this->dropIndexIfExists('us_clients',     'us_clients_cycle_id_idx');
        $this->dropIndexIfExists('s_q_clients',    's_q_clients_cycle_id_idx');
    }
};
