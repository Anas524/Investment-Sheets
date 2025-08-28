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
        Schema::create('gts_materials_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->constrained('gts_materials')->onDelete('cascade');
            $table->string('description')->nullable();
            $table->integer('units')->nullable();
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->decimal('vat', 5, 2)->nullable();
            $table->decimal('weight_per_ctn', 12, 2)->nullable();
            $table->integer('ctns')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gts_materials_items');
    }
};
