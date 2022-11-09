import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'lnr-my-bikes-merge-modal',
  templateUrl: './my-bikes-merge-modal.component.html',
  styleUrls: ['./my-bikes-merge-modal.component.scss'],
})
export class MyBikesMergeModalComponent {
  constructor(public dialogRef: MatDialogRef<MyBikesMergeModalComponent>) {}

  submit(): void {
    this.dialogRef.close({ approved: true });
  }

  close(): void {
    this.dialogRef.close({ approved: false });
  }
}
