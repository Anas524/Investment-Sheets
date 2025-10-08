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
    public function up(): void
    {
         // 0) TEMP: if a trigger expects total_material_card, re-create a stub so UPDATEs don't fail
        Schema::table('gts_materials', function (Blueprint $t) {
            if (!Schema::hasColumn('gts_materials', 'total_material_card')) {
                $t->decimal('total_material_card', 18, 2)->nullable()->after('total_material');
            }
        });

        // 1) Add new ui_total_material (idempotent)
        Schema::table('gts_materials', function (Blueprint $t) {
            if (!Schema::hasColumn('gts_materials', 'ui_total_material')) {
                $t->decimal('ui_total_material', 18, 2)->nullable()->default(0)->after('total_material');
                $t->index('ui_total_material');
            }
        });

        // 2) Backfill from items (your columns: units, unit_price, vat, material_id)
        if (Schema::hasTable('gts_materials_items') && Schema::hasColumn('gts_materials_items', 'material_id')) {
            DB::statement("
                UPDATE gts_materials m
                LEFT JOIN (
                    SELECT material_id,
                           ROUND(SUM(COALESCE(units,0) * COALESCE(unit_price,0) + COALESCE(vat,0)), 2) AS calc_total
                    FROM gts_materials_items
                    GROUP BY material_id
                ) x ON x.material_id = m.id
                SET m.ui_total_material = COALESCE(x.calc_total, m.ui_total_material, 0)
            ");
        }

        // 3) Fallback from legacy totals if any remaining are 0/null
        DB::statement("
            UPDATE gts_materials m
            SET m.ui_total_material = COALESCE(
                NULLIF(m.ui_total_material, 0),
                m.total_material,
                m.total_material_buy,
                0
            )
        ");

        // 4) Now it’s safe to drop the old column again
        Schema::table('gts_materials', function (Blueprint $t) {
            if (Schema::hasColumn('gts_materials', 'total_material_card')) {
                $t->dropColumn('total_material_card');
            }
        });
    }

    public function down(): void
    {
        Schema::table('gts_materials', function (Blueprint $t) {
            if (Schema::hasColumn('gts_materials', 'ui_total_material')) {
                $t->dropColumn('ui_total_material');
            }
            // We do NOT recreate total_material_card
        });
    }
};
