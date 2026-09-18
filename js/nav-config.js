(function(){
  window.DCC_TABS = [
    { id:'home',        label:'Home',             table:'home' },
    { id:'attendance',  label:'Attendance',       table:'attendance' },
    { id:'fms-okhla',   label:'FMS – Okhla',      table:'fms_systems', filter:function(r){ return r.location === 'Okhla'; } },
    { id:'fms-gurgaon', label:'FMS – Gurgaon',    table:'fms_systems', filter:function(r){ return r.location === 'Gurgaon'; } },
    { id:'fms-ho',      label:'FMS – Head Office',table:'fms_systems', filter:function(r){ return r.location === 'Head Office'; } },
    { id:'ims-po',      label:'Create Purchase Order', table:'ims', filter:function(r){ return r.category === 'purchase_order'; } },
    { id:'ims-reorder', label:'Reorder',              table:'ims', filter:function(r){ return r.category === 'reorder'; } },
    { id:'ims-cf',      label:'C&F Inventory',         table:'ims', filter:function(r){ return r.category === 'cf_inventory'; } },
    { id:'mis',         label:'MIS',              table:'mis' },
    { id:'crm',         label:'CRM',              table:'crm' },
    { id:'delegation',  label:'Delegation',       table:'delegation' },
    { id:'hr',          label:'Human Resource',   table:'human_resource' }
  ];

  window.DCC_MENUS = {
    orders:{
      title:'Orders',
      items:[
        { label:'Create Purchase Order', tab:'ims-po' },
        { label:'Reorder', tab:'ims-reorder' },
        { label:'C&F Inventory', tab:'ims-cf' }
      ]
    },
    despatch:{
      title:'Dispatch',
      items:[
        { label:'FMS – Okhla', tab:'fms-okhla' },
        { label:'FMS – Gurgaon', tab:'fms-gurgaon' },
        { label:'FMS – Head Office', tab:'fms-ho' }
      ]
    },
    payments:{
      title:'Payments',
      items:[
        { label:'CRM', tab:'crm' }
      ]
    },
    stock:{
      title:'C and F stock',
      items:[
        { label:'C&F Inventory (IMS)', tab:'ims-cf' }
      ]
    },
    systems:{
      title:'All systems',
      items:[
        { label:'Home', tab:'home' },
        { label:'Attendance', tab:'attendance' },
        { label:'MIS', tab:'mis' },
        { label:'Delegation', tab:'delegation' },
        { label:'Human Resource', tab:'hr' }
      ]
    }
  };
})();
