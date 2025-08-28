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
        Schema::create('customer_sheet_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_sheet_id')->constrained()->onDelete('cascade'); // RH, WS, etc.
            $table->date('date');
            $table->string('supplier');
            $table->text('description')->nullable();
            $table->decimal('total_material_buy', 12, 2)->default(0);
            $table->decimal('total_shipping_cost', 12, 2)->default(0);
            $table->decimal('total_vat', 12, 2)->default(0);
            $table->decimal('total_weight', 12, 2)->default(0);
            $table->integer('total_units')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_sheet_entries');
    }
};
