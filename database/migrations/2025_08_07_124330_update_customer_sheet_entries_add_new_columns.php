<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('customer_sheet_entries', function (Blueprint $table) {
            $table->decimal('total_material_without_vat', 12, 2)->default(0);
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->decimal('dgd', 12, 2)->default(0);
            $table->decimal('labour', 12, 2)->default(0);
            $table->string('mode_of_transaction')->nullable();
            $table->string('receipt_no')->nullable();
            $table->text('remarks')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
