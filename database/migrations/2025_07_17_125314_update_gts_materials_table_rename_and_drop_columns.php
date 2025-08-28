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
        Schema::table('gts_materials', function (Blueprint $table) {
            // Rename description → brief_description
            $table->renameColumn('description', 'brief_description');

            // Drop items_data
            $table->dropColumn('items_data');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('gts_materials', function (Blueprint $table) {
            // Revert column name
            $table->renameColumn('brief_description', 'description');

            // Re-add items_data column (assuming it was text)
            $table->text('items_data')->nullable();
        });
    }
};
