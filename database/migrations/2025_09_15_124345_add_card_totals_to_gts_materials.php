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
        Schema::table('gts_materials', function (Blueprint $table) {
            // Persisted shipping total used by cards/summary
            if (!Schema::hasColumn('gts_materials', 'total_shipping_cost')) {
                $table->decimal('total_shipping_cost', 15, 2)
                    ->default(0)
                    ->after('labour');
            }

            // Persisted "Total Material" value that the cards show
            // (keep existing total_material/total_material_buy untouched)
            if (!Schema::hasColumn('gts_materials', 'total_material_card')) {
                $table->decimal('total_material_card', 15, 2)
                    ->default(0)
                    ->after('total_material_buy');
            }
        });

        // Backfill shipping = shipping_cost + dgd + labour
        DB::statement("
            UPDATE gts_materials m
            SET m.total_shipping_cost =
                ROUND(COALESCE(m.shipping_cost,0) + COALESCE(m.dgd,0) + COALESCE(m.labour,0), 2)
        ");

        // Backfill material card total.
        // Prefer recompute from items; if no items exist fall back to total_material_buy.
        DB::statement("
            UPDATE gts_materials m
            LEFT JOIN (
                SELECT material_id,
                       ROUND(SUM(COALESCE(units,0) * COALESCE(unit_price,0) + COALESCE(vat,0)), 2) AS calc_total
                FROM gts_materials_items
                GROUP BY material_id
            ) x ON x.material_id = m.id
            SET m.total_material_card = COALESCE(x.calc_total, m.total_material_buy, 0)
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gts_materials', function (Blueprint $table) {
            if (Schema::hasColumn('gts_materials', 'total_material_card')) {
                $table->dropColumn('total_material_card');
            }
            if (Schema::hasColumn('gts_materials', 'total_shipping_cost')) {
                $table->dropColumn('total_shipping_cost');
            }
        });
    }
};
