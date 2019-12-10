import * as React from "react";

export const CardBody: React.FC = props => {
    return (
        <div className="card-body">
            {props.children}
        </div>
    );
}
