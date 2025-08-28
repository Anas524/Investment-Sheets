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
        Schema::create('gts_materials', function (Blueprint $table) {
            $table->id();
            $table->date('invoice_date')->nullable();
            $table->string('invoice_no')->nullable();
            $table->string('supplier_name')->nullable();
            $table->string('description')->nullable();
            $table->decimal('shipping_cost', 15, 2)->default(0);
            $table->decimal('dgd', 15, 2)->default(0);
            $table->decimal('labour', 15, 2)->default(0);
            $table->decimal('total_material', 15, 2)->default(0);
            $table->decimal('total_vat', 15, 2)->default(0);
            $table->decimal('total_material_buy', 15, 2)->default(0);
            $table->decimal('total_weight', 15, 2)->default(0);
            $table->string('mode_of_transaction')->nullable();
            $table->string('receipt_no')->nullable();
            $table->text('remarks')->nullable();
            $table->json('items_data')->nullable(); // Store the items table as JSON
            $table->enum('status', ['draft', 'saved'])->default('draft');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gts_materials');
    }
};
