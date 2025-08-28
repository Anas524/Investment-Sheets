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
        Schema::create('local_sale_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('local_id')->constrained('locals')->cascadeOnDelete(); // <- single line
            $table->string('invoice_path')->nullable();
            $table->string('receipt_path')->nullable();
            $table->string('delivery_note_path')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('local_sale_attachments');
    }
};
