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
        Schema::create('pl_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('month_id')->constrained('pl_months')->cascadeOnDelete();
            $table->enum('section', ['revenue', 'expense']);
            $table->string('code');  // e.g. rev_gts, exp_rent
            $table->string('label'); // left text shown in sheet
            $table->decimal('amount', 14, 2)->default(0);
            $table->text('remarks')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['month_id', 'section', 'sort_order']);
            $table->unique(['month_id', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pl_lines');
    }
};
