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
        Schema::create('locals', function (Blueprint $table) {
            $table->id();
            $table->date('date');
            $table->string('client');
            $table->text('description')->nullable();          // brief description (header row)
            $table->enum('payment_status', ['paid','pending','partial'])->default('pending');
            $table->text('remarks')->nullable();

            // aggregates (from item rows)
            $table->unsignedInteger('total_units')->default(0);
            $table->decimal('total_ex_vat', 15, 2)->default(0);
            $table->decimal('vat_amount',   15, 2)->default(0); // sum of user-entered VATs
            $table->decimal('total_inc_vat',15, 2)->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('locals');
    }
};
