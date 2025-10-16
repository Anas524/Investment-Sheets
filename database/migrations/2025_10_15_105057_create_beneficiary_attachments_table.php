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
        Schema::create('beneficiary_attachments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('entry_id');
            $table->string('type', 32)->nullable();   // invoice|receipt|note|other
            $table->string('original_name')->nullable();
            $table->string('path');
            $table->string('mime', 128)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();

            $table->foreign('entry_id')
                ->references('id')->on('beneficiary_entries')
                ->cascadeOnDelete();

            $table->index('entry_id');
            $table->index('type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('beneficiary_attachments');
    }
};
