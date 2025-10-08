<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('gts_materials_items')) {
            DB::statement("
                UPDATE gts_materials m
                LEFT JOIN (
                    SELECT material_id,
                           ROUND(SUM(COALESCE(units,0) * COALESCE(unit_price,0) + COALESCE(vat,0)), 2) AS calc_total
                    FROM gts_materials_items
                    GROUP BY material_id
                ) x ON x.material_id = m.id
                SET m.ui_total_material = COALESCE(x.calc_total, 0)
            ");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
