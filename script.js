const modal=document.getElementById("myModal");
const openModalBtn=document.getElementById("openModalBtn");
const closeModal=document.querySelector(".close");
openModalBtn.onclick=function(){
    modal.style.display="block";
};
closeModal.onclick=function(){
    modal.style.display="none";
};
window.onclick=function(event){
    if(event.target==modal){
        modal.style.display="none";
    }
};