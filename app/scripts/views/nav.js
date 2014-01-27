/*global define*/

define([
    'jquery',
    'underscore',
    'backbone',
    'templates',
    'elements/nav',
    'views/plat',
    'views/tab',
    'views/word',
    'models/plat',
    'models/plats',
    'models/key',
    'models/tab',
    'models/word',
    'models/jtab'
], function ($, _, Backbone, JST, DOM, PlatView, TabView, WordView, PlatModel, PlatModelCollection, KeyModel, TabModel, WordModel, jTabModel) {

    'use strict';

    var NavView = Backbone.View.extend({
        
        tagName: "nav",
        template: JST['app/scripts/templates/nav.ejs'],
        attributes: { 'id':'Nav' },

        initialize: function(){

            // add collection
            this.platModelCollection = new PlatModelCollection();

            // render nav
            this.render();

            // register subs
            Backbone.pubSub.on("plot:clicked", this.tabFinderTextUpdate, this);
            Backbone.pubSub.on("plot:clicked", this.tabHint, this);
            Backbone.pubSub.on('message:broadcast', this.message, this);

        },

        events: function() {

            // events container
            var e = {};

            // dynamically named events
            e['click '  + DOM.menuHome] = 'subNav';
            e['click '  + DOM.menuWord] = 'subNav';
            e['click '  + DOM.menuPlat] = 'subNav';
            e['click '  + DOM.menuTab]  = 'subNav';
            e['click '  + DOM.wordAdd]  = 'wordFind';
            e['click '  + DOM.platsKey] = 'platAdd';
            e['click '  + DOM.tabAdd]   = 'tabAdd';
            e['focus '  + DOM.tabFind]  = 'tabHint';
            e['keyup '  + DOM.tabFind]  = 'tabHint';
            e['click '  + DOM.tabHints] = 'tabHintClick';

            // return object
            return e;

        },

        // MESSAGING

        message:function(msg){

            // template
            var template = JST['app/scripts/templates/message.ejs'];

            // attach notes
            var message = template({ title:msg.title, message:msg.message });

            // add to dom
            $("#Main").append(message);

            // hide automatically after time
            var timeout = setTimeout(function(){ 
                $("#Message").fadeOut( "slow", function() {
                    this.remove();
                });
            }, msg.time);

            // remove on click
            $("#Message").on('click',function(){ 
                this.remove(); 
                clearTimeout(timeout); 
            });

        },

        // SUBNAV

        subNav:function(e){

            var item  = $(e.target).attr('item');
            var items = [DOM.menuHome, DOM.Home, DOM.menuWord, DOM.Words, DOM.words, DOM.Plats, DOM.menuPlat, DOM.Tabs, DOM.menuTab, DOM.plats, DOM.tabs];

            function hideAllExcept(els){
                items.filter(function(item){ 
                    if(els.indexOf(item) < 0) $(item).removeClass('showing'); 
                });
            }

            switch (item)
            {
                case 'home':
                    $(DOM.menuHome).toggleClass('showing');
                    $(DOM.Home).toggleClass('showing');
                    hideAllExcept([DOM.menuHome, DOM.Home]);
                    break;
                case 'words':
                    $(DOM.menuWord).toggleClass('showing');
                    $(DOM.Words).toggleClass('showing');
                    $(DOM.words).toggleClass('showing');
                    hideAllExcept([DOM.menuWord, DOM.Words, DOM.words]);
                    break;
                case 'plats':
                    $(DOM.menuPlat).toggleClass('showing');
                    $(DOM.plats).toggleClass('showing');
                    $(DOM.Plats).toggleClass('showing');
                    hideAllExcept([DOM.menuPlat, DOM.plats, DOM.Plats]);
                    break;
                case 'tabs':
                    $(DOM.menuTab).toggleClass('showing');
                    $(DOM.tabs).toggleClass('showing');
                    $(DOM.Tabs).toggleClass('showing');
                    hideAllExcept([DOM.menuTab, DOM.tabs, DOM.Tabs]);
                    break;
            }

            // if target is showing, hide
            // else, show and
        },

        // WORDS

        wordFind:function(e){

            var word  = $(DOM.wordFind).val();
            var model = new WordModel({ word:word });
            var view  = new WordView({ model:model });

        },

        // TABS

        tabFindFormatter:function(){

            // cap first string
            var string = $(DOM.tabFind).val();
                string = string.charAt(0).toUpperCase() + string.slice(1);

            // reset value
            $(DOM.tabFind).val(string);

        },

        tabHint:function(){

            // visual formatter
            this.tabFindFormatter();

            // now do internal formatting 
            var text  = $(DOM.tabFind).val().replace("*","dim");

            if(text.length) {

                var jtab  = new jTabModel(text);
                var hints = [];

                // loop keys
                for(var key in jtab.baseChords){
                    var isLength  = key.length == text.length + 1;
                    var isSimilar = key.substring(0, text.length) == text; 
                    if(isLength && isSimilar) hints.push(key);
                }

                // remove hints
                $(DOM.tabHints).remove();

                // prepend onto tab subnav
                _.each(hints, function(hint, i){
                    var li = '<li class="hint"><a>'+hint+'</a></li>';
                    if(i <= 3) $(DOM.tabItems).append(li);
                });

            }
            
        },

        tabHintClick:function(e){

            // get this hints text
            var chord = $(e.target).text();

            // assign it to the tabfinder
            $(DOM.tabFind).val(chord);

            // rerun tabhint after
            this.tabHint();

            // change focus back to window
            $(window).focus();
            
        },

        // updates tab finder text on plot:clicked event usually
        tabFinderTextUpdate:function(plot){
            var chord = (plot.chord.note + plot.chord.type).replace('M','');
            $(DOM.tabFind).val(chord);
            return chord;
        },

        // add tab to dashboard
        tabAdd:function(e){

            // get chord name
            var name = $(DOM.tabFind).val().trim().replace('*','dim');

            // get variations up to fret 19
            var variations  = [];

            for(var i = 1; i < 20; i++){
                var chord = new jTabModel(name + ':' + i); // get chord by NAME:CAGED_INDEX
                var isFrettable = chord.chordArray[0] <= 19; // is this chord still on the fretboard
                if(isFrettable) variations.push(chord); // if on fretboard, collect it
                if(!isFrettable) break; // quit if frets are off the board
            }

            // check if any chords where found
            if(variations.length){

                // create tab model
                var model = new TabModel({ variations:variations, chord:name });

                // create tab
                var tab = new TabView({ model:model });

                // pub modification
                Backbone.pubSub.trigger('tab:modified', e.currentTarget); 

            } else {

                var msg = { title:'Whoops!', message:'The chord you entered was not found.', time:2000}
                Backbone.pubSub.trigger('message:broadcast', msg);

            }

            

        },

        // PLATS

        // add plat to dashboard, or remove it if it already exists
        platAdd:function(e){

            // add or remove?
            var mode = $(e.currentTarget).parent().hasClass('showing') ? 'remove' : 'add';
            var key  = $(e.currentTarget).data('key');

            switch(mode)
            {
                case 'add':
                    this.platCreate(key);
                    break;
                case 'remove':
                    this.platRemove(key);
                    break;
            }

            $(e.currentTarget).parent().toggleClass('showing');

            // pub modification
            Backbone.pubSub.trigger('plat:modified', e.currentTarget); 

        },

        // create a new plat
        platCreate:function(key){

            // create unique id
            var id = 'plat'+key;

            // create unique model and add to collection
            var model = new PlatModel({ id:id, key:key });
                this.platModelCollection.add(model);

            // create unique view and
            var view = new PlatView({ id:id, model:model });

            // render plat view
            view.render();

        },

        // remove plat by key
        platRemove:function(key){

            // get model by id
            var id    = 'plat'+key;
            var model = this.platModelCollection.get(id);
                this.platModelCollection.remove(model);

            // broadcast for localized garbage collection
            Backbone.pubSub.trigger('plat:destroy', id); 
            
        },

        // render the nav
        render: function(){

            // create key model
            var key = new KeyModel();

            // attach notes
            this.$el.html( this.template({ keys:key.get('notation').roots }) );

            // add to main template
            $('#Main').append(this.$el);

            // debugging
            // $(DOM.tabFind).val('B');
            // setTimeout(function(){ $(DOM.tabAdd).click(); }, 100);

        }

    });

    return NavView;

});
